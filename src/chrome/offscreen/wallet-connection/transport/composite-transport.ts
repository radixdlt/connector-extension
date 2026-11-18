import type { Observable } from 'rxjs'
import {
  BehaviorSubject,
  Subject,
  Subscription,
  distinctUntilChanged,
  filter,
  firstValueFrom,
  of,
  timeout,
} from 'rxjs'
import { globalTimers, type Timers } from 'utils/timers'
import { ResultAsync, errAsync, okAsync } from 'neverthrow'
import type { AppLogger } from 'utils/logger'
import { config as appConfig } from 'config'
import { LimitedLogger } from 'utils/limited-logger'
import { describePayload } from 'utils/log-summary'
import type { RadixConnectTransport } from 'options/radix-connect-transport'
import {
  messageErrorReasons,
  type MessageErrorReason,
  type SendMessageError,
  type TransportMessage,
  type WalletNotice,
  type WalletTransport,
} from './wallet-transport'
import {
  transportNames,
  type LinkStats,
  type TransportDiagnostics,
  type TransportName,
} from './diagnostics'
import { RecentEvents } from './transport-events'
import { IncomingDuplicates } from './incoming-duplicates'
import { sendOrderOf } from './send-order'
import type {
  LinkTransport,
  TransportConnectionConfig,
  TransportSlot,
} from './transport-slots'

export type { TransportConnectionConfig } from './transport-slots'

export type CompositeTransport = WalletTransport<TransportConnectionConfig> & {
  /**
   * Lets the wallet finish on iroh, then closes the iroh endpoint: waits until the
   * wallet closed its iroh connection (at most `graceMs`), then shuts the iroh
   * session down. Resolves once its endpoint is closed, so that another one for the
   * same password can take over. WebRTC is not affected.
   */
  releaseIroh: (graceMs: number) => ResultAsync<void, never>
  diagnostics: () => TransportDiagnostics
  /** The network may have changed: iroh checks its connection (see `IrohTransport`). */
  networkChanged: (reason: string) => void
  /**
   * The connected transport the next message goes through (see `diagnostics`):
   * `undefined` while none is connected. Emits each change, as it happens.
   */
  sendingVia$: Observable<TransportName | undefined>
}

/** Failures after which nothing reached the wallet: another transport may send it. */
const nothingWasSent = (reason: MessageErrorReason) =>
  reason === messageErrorReasons.notConnected ||
  reason === messageErrorReasons.failedToPrepareMessage

/** The error's code (iroh) or name, never its message: it may quote data. */
const errorCode = (error: SendMessageError) => {
  const jsError = error.jsError as (Error & { code?: unknown }) | undefined
  if (typeof jsError?.code === 'string') return jsError.code
  return typeof jsError?.name === 'string' ? jsError.name : undefined
}

/** Only ids and kinds: what logs may say about a message, without its size. */
const idsOf = (description: Record<string, string | number>) =>
  Object.fromEntries(
    Object.entries(description).filter(([key]) => key !== 'bytes'),
  )

const countsOf = (): Record<TransportName, number> =>
  Object.fromEntries(transportNames.map((name) => [name, 0])) as Record<
    TransportName,
    number
  >

/**
 * The transports selected by the `radixConnectTransport` option, behind one
 * `WalletTransport`. Each link keeps every selected transport running; none is
 * chosen once and for all:
 *
 * - `connected$` is true while any selected transport is connected,
 * - `onMessage$` merges the messages of all of them, without the duplicates a
 *   wallet may send over several (a message identical to one received within
 *   `incomingDuplicateWindowMs`),
 * - `sendMessage` prefers iroh: it uses iroh while it is connected, WebRTC
 *   otherwise. It tries the next transport when one sent nothing
 *   (`notConnected`, `failedToPrepareMessage`), never after a failure where the
 *   wallet may have received the message (`timeout`, `failedToSendMessage`): the
 *   wallet does not drop duplicates. After such a failure on iroh, the next messages
 *   (the queues' retries included) go over WebRTC while it is connected, for
 *   `irohHoldBackMs` or until iroh reconnects.
 *
 * The transports, and how they rank, are its `slots` (see `transportSlots`): a new
 * transport is one more slot.
 *
 * Nothing connects before the first `setConnectionConfig`, as with WebRTC alone.
 * The iroh transport is created the first time it is selected (so the wasm module is
 * only loaded when needed) and is reused afterwards, which keeps its sessions
 * strictly one after another.
 *
 * Logs (through the link's logger): which transports run and why, the link's merged
 * state, which transport carried each message (ids and size, never contents),
 * fallbacks, failures with their category and limits, and dropped duplicates.
 */
export const CompositeTransport = (input: {
  /** The link's transports, by preference (see `transportSlots`). */
  slots: TransportSlot[]
  logger?: AppLogger
  irohHoldBackMs?: number
  /** Sends timed out in a row, while connected, that restart a transport. */
  stalledSendsBeforeRestart?: number
  incomingDuplicateWindowMs?: number
  now?: () => number
  timers?: Pick<Timers, 'setTimeout' | 'clearTimeout'>
}): CompositeTransport => {
  const { logger } = input
  const now = input.now ?? Date.now
  const holdBackMs =
    input.irohHoldBackMs ?? appConfig.transport.irohHoldBackAfterFailure
  const stalledSendsBeforeRestart = input.stalledSendsBeforeRestart ?? 2
  const duplicateWindowMs =
    input.incomingDuplicateWindowMs ??
    appConfig.transport.incomingDuplicateWindow
  const intervalMs = appConfig.diagnostics.logRepeatInterval
  const log = LimitedLogger(logger, { intervalMs, now })
  // State changes are worth seeing one by one, unless the link flaps.
  const stateLog = LimitedLogger(logger, { intervalMs, burst: 10, now })
  const events = RecentEvents({ max: appConfig.diagnostics.recentEvents, now })

  const { slots } = input
  const slotOf = (name: TransportName) =>
    slots.find((slot) => slot.name === name)!

  let mode: RadixConnectTransport | undefined
  let shouldConnect = false
  let password: Buffer | undefined
  let destroyed = false
  let running: TransportName[] = []
  let lastVia = 'none'

  const created = new Map<TransportName, LinkTransport>()
  const connectedState = new Map<TransportName, boolean>()
  const heldBackUntil = new Map<TransportName, number>()
  const connects = countsOf()
  const stats: LinkStats = {
    sent: countsOf(),
    received: countsOf(),
    fallbacks: 0,
    failed: 0,
    duplicatesDropped: 0,
  }
  const duplicates = IncomingDuplicates({ windowMs: duplicateWindowMs, now })

  const timers = input.timers ?? globalTimers
  // When the transport held back last is preferred again.
  let holdBackTimer: unknown
  const connectedSubject = new BehaviorSubject(false)
  const sendingViaSubject = new BehaviorSubject<TransportName | undefined>(
    undefined,
  )
  const onMessageSubject = new Subject<TransportMessage>()
  const walletNoticeSubject = new Subject<WalletNotice>()
  const subscription = new Subscription()

  const isConnected = (name: TransportName) => !!connectedState.get(name)

  /**
   * Sends that timed out in a row on each transport. A transport that says it is
   * connected but delivers nothing (the WebRTC library's send path can die while its
   * connection stays up) is restarted after `stalledSendsBeforeRestart` of them: it is
   * built again from scratch, and the next attempt goes through it.
   */
  const timedOutInARow = new Map<TransportName, number>()
  const noteSendOutcome = (via: TransportName, error?: SendMessageError) => {
    if (error?.reason !== messageErrorReasons.timeout) {
      timedOutInARow.delete(via)
      return
    }
    const count = (timedOutInARow.get(via) ?? 0) + 1
    timedOutInARow.set(via, count)
    if (count < stalledSendsBeforeRestart || !isConnected(via)) return
    timedOutInARow.delete(via)
    logger?.warn(`${via}: connected but delivering nothing; restarting it`, {
      timedOut: count,
    })
    events.add(via, `restarted: ${count} sends timed out while connected`)
    created.get(via)?.restart()
  }
  const isSelected = (name: TransportName) =>
    !!mode && slotOf(name).isSelectedBy(mode)
  const selected = (): TransportName[] =>
    slots.map((slot) => slot.name).filter(isSelected)
  /** Selected, and created: the transports that may be used now. */
  const available = () => selected().filter((name) => created.has(name))

  const heldBackForMs = (name: TransportName) =>
    Math.max((heldBackUntil.get(name) ?? 0) - now(), 0)

  /** Transports to try, in order, for one message. */
  const sendOrder = (): TransportName[] =>
    sendOrderOf(available(), {
      isConnected,
      isPreferred: (name) => slotOf(name).preferred,
      heldBackForMs,
    })

  /** The connected transport the next message goes through, if any. */
  const sendingVia = (): TransportName | undefined => {
    const first = sendOrder()[0]
    return first && isConnected(first) ? first : undefined
  }

  const connectedVia = () => selected().filter(isConnected)

  const updateConnected = () => {
    const via = connectedVia()
    const viaText = via.join(', ') || 'none'
    if (viaText !== lastVia) {
      const details = {
        state: via.length ? 'connected' : 'not connected',
        via: viaText,
        sendingVia: sendingVia() ?? 'none',
        previously: lastVia,
        mode,
      }
      lastVia = viaText
      stateLog.info('state', 'link state changed', details)
      events.add(
        'link',
        via.length ? `connected via ${viaText}` : 'not connected',
      )
    }
    const connected = via.length > 0
    if (connected !== connectedSubject.value) connectedSubject.next(connected)
    sendingViaSubject.next(sendingVia())
  }

  const disconnectReason = (name: TransportName) => {
    try {
      return created.get(name)?.disconnectReason()
    } catch (error) {
      return undefined
    }
  }

  const onTransportState = (name: TransportName, connected: boolean) => {
    const was = isConnected(name)
    connectedState.set(name, connected)
    if (connected !== was) {
      if (connected) {
        connects[name] += 1
        if (heldBackUntil.get(name)) {
          // A new connection: it is preferred again.
          heldBackUntil.delete(name)
          logger?.info(`${name} reconnected: preferred again for sending`)
        }
        events.add(name, connects[name] > 1 ? 'reconnected' : 'connected')
      } else {
        const reason = disconnectReason(name)
        events.add(name, reason ? `disconnected: ${reason}` : 'disconnected')
      }
    }
    updateConnected()
  }

  /** Delivers a message from the wallet, unless it is a recent duplicate. */
  const onIncoming = (via: TransportName) => (message: TransportMessage) => {
    const description = describePayload(message)
    const { first, time } = duplicates.check(message, via)
    if (first) {
      stats.duplicatesDropped += 1
      log.info(
        `duplicate:${via}:${first.via}`,
        'dropped a duplicate message from the wallet',
        {
          via,
          firstVia: first.via,
          sinceFirstMs: time - first.at,
          windowMs: duplicateWindowMs,
          ...description,
        },
      )
      events.add(via, `dropped a duplicate (first received via ${first.via})`)
      return
    }
    stats.received[via] += 1
    logger?.info('received a message from the wallet', { via, ...description })
    onMessageSubject.next(message)
  }

  const setPassword = (name: TransportName, buffer: Buffer) => {
    const result = created.get(name)!.setConnectionPassword(buffer)
    return slotOf(name).lazy
      ? result.mapErr((error) => {
          logger?.error(`${name}: invalid connection password`, error.message)
          return error
        })
      : result
  }

  /** The transport of `slot`, created (and followed) the first time. */
  const transportOf = (slot: TransportSlot) => {
    const existing = created.get(slot.name)
    if (existing) return existing
    const transport = slot.create()
    created.set(slot.name, transport)
    subscription.add(
      transport.connected$.subscribe((connected) =>
        onTransportState(slot.name, connected),
      ),
    )
    subscription.add(transport.onMessage$.subscribe(onIncoming(slot.name)))
    subscription.add(
      transport.walletNotices$.subscribe((notice) => {
        if (notice.type === 'walletClosed') closeOtherTransports(slot.name)
        // The requests a wallet lists over WebRTC are only those it got over WebRTC:
        // while iroh is connected, the iroh library sends again what the wallet lost,
        // and acting on this list too would deliver it twice.
        if (
          notice.type === 'requestsHeld' &&
          slot.name !== 'iroh' &&
          isConnected('iroh')
        )
          return
        walletNoticeSubject.next(notice)
      }),
    )
    return transport
  }

  /**
   * `closedBy` found the wallet's app closed: the other transports' connections are to
   * the same app, and dead, though they may take seconds to notice (WebRTC: about 7 s,
   * measured). They are restarted now, so the link shows it at once; each reconnects
   * by itself when the app is back.
   */
  function closeOtherTransports(closedBy: string) {
    for (const [name, transport] of created) {
      if (name === closedBy || !isConnected(name)) continue
      logger?.info('the wallet app was closed: closing this transport too', {
        transport: name,
        closedBy,
      })
      events.add(name, `closed: the wallet app was closed (${closedBy})`)
      transport.restart()
    }
  }

  for (const slot of slots) if (!slot.lazy) transportOf(slot)

  /** Logs which transports run, when that changes, and why. */
  const updateRunning = (reason: string) => {
    const next = shouldConnect && !destroyed ? selected() : []
    if (next.join() === running.join()) return
    const started = next.filter((name) => !running.includes(name))
    const stopped = running.filter((name) => !next.includes(name))
    running = next
    logger?.info('link transports changed', {
      mode,
      running: next.join(', ') || 'none',
      started: started.join(', ') || 'none',
      stopped: stopped.join(', ') || 'none',
      reason,
    })
    events.add('link', `transports: ${next.join(', ') || 'none'} (${reason})`)
  }

  /** After a failure where the wallet may have it: the others send for a while. */
  const holdBack = (
    via: TransportName,
    error: SendMessageError,
    description: Record<string, string | number>,
  ) => {
    const others = selected().filter((name) => name !== via)
    if (!slotOf(via).preferred || !others.length) return
    heldBackUntil.set(via, now() + holdBackMs)
    sendingViaSubject.next(sendingVia())
    timers.clearTimeout(holdBackTimer)
    holdBackTimer = timers.setTimeout(
      () => sendingViaSubject.next(sendingVia()),
      holdBackMs,
    )
    const othersText = others.map((name) => slotOf(name).label).join(', ')
    log.warn(
      `${via}-held-back:${error.reason}`,
      `${via} did not deliver a message; not resent now (the wallet may have received it), the next messages go over ${othersText} while it is connected`,
      {
        reason: error.reason,
        code: errorCode(error),
        holdBackMs,
        ...idsOf(description),
      },
    )
    events.add(
      via,
      `send failed (${error.reason}); ${othersText} preferred for ${holdBackMs} ms`,
    )
  }

  const sendMessage = (
    message: TransportMessage,
    options?: { timeout?: number },
  ): ResultAsync<undefined, SendMessageError> => {
    const order = sendOrder()
    const description = describePayload(message)
    const startedAt = now()
    const tried: TransportName[] = []

    const attempt = (
      index: number,
      fallbackFrom?: { via: TransportName; reason: MessageErrorReason },
    ): ResultAsync<undefined, SendMessageError> => {
      const via = order[index]
      if (!via) return errAsync({ reason: messageErrorReasons.notConnected })
      tried.push(via)
      return created
        .get(via)!
        .sendMessage(message, options)
        .map(() => {
          noteSendOutcome(via)
          stats.sent[via] += 1
          if (fallbackFrom) stats.fallbacks += 1
          logger?.info('sent a message to the wallet', {
            via,
            ...description,
            durationMs: now() - startedAt,
            ...(fallbackFrom
              ? {
                  fallbackFrom: fallbackFrom.via,
                  fallbackReason: fallbackFrom.reason,
                }
              : {}),
          })
          return undefined
        })
        .orElse((error) => {
          noteSendOutcome(via, error)
          const next = order[index + 1]
          if (next && nothingWasSent(error.reason)) {
            log.info(
              `fallback:${via}:${error.reason}`,
              'sending fell back to the other transport',
              {
                from: via,
                to: next,
                reason: error.reason,
                code: errorCode(error),
                ...idsOf(description),
              },
            )
            events.add(via, `send failed (${error.reason}), trying ${next}`)
            return attempt(index + 1, { via, reason: error.reason })
          }
          if (!nothingWasSent(error.reason)) holdBack(via, error, description)
          return errAsync(error)
        })
    }

    return attempt(0).mapErr((error) => {
      stats.failed += 1
      // Without a connection the queues wait and retry: not a failure worth a
      // warning. The message is described by its ids and size.
      const details = {
        reason: error.reason,
        code: errorCode(error),
        transports: tried.join(', ') || 'none selected',
        ...description,
        durationMs: now() - startedAt,
        ...(error.reason === messageErrorReasons.timeout
          ? { timeoutMs: options?.timeout }
          : {}),
      }
      if (error.reason === messageErrorReasons.notConnected)
        log.info(
          `send:${error.reason}`,
          'sending a message to the wallet failed',
          details,
        )
      else {
        log.warn(
          `send:${error.reason}:${details.transports}`,
          'sending a message to the wallet failed',
          details,
        )
        events.add(
          'link',
          `send failed: ${error.reason} via ${details.transports}`,
        )
      }
      return error
    })
  }

  const diagnosticsOf = (name: TransportName) =>
    available().includes(name) ? created.get(name)!.diagnostics() : undefined

  return {
    connected$: connectedSubject.asObservable(),
    onMessage$: onMessageSubject.asObservable(),
    walletNotices$: walletNoticeSubject.asObservable(),
    reportsRequests: () =>
      [...created.values()].some((transport) => transport.reportsRequests()),
    forgetRequest: (interactionId: string) => {
      for (const transport of created.values())
        transport.forgetRequest(interactionId)
    },
    sendingVia$: sendingViaSubject.pipe(distinctUntilChanged()),
    setConnectionPassword: (buffer: Buffer) => {
      password?.fill(0)
      password = Buffer.from(buffer)
      return ResultAsync.combine(
        [...created.keys()].map((name) => setPassword(name, buffer)),
      ).map(() => undefined)
    },
    setConnectionConfig: (config: TransportConnectionConfig) => {
      if (destroyed) return
      const previousMode = mode
      mode = config.transport
      if (mode !== previousMode) heldBackUntil.clear()
      updateRunning(
        previousMode && previousMode !== mode
          ? `option changed: ${previousMode} → ${mode}`
          : `option: ${mode}`,
      )

      for (const slot of slots) {
        if (isSelected(slot.name)) {
          const transport = transportOf(slot)
          transport.setConnectionConfig(config)
          if (slot.lazy && password) setPassword(slot.name, password)
          if (shouldConnect) transport.connect()
        } else {
          created.get(slot.name)?.disconnect()
        }
      }

      updateConnected()
    },
    sendMessage,
    connect: () => {
      if (destroyed) return
      shouldConnect = true
      for (const name of available()) created.get(name)!.connect()
      updateRunning(`connect, option: ${mode ?? 'not known yet'}`)
    },
    disconnect: () => {
      shouldConnect = false
      for (const transport of created.values()) transport.disconnect()
      updateRunning('disconnect')
    },
    restart: () => {
      const restarting = selected()
      for (const name of available()) created.get(name)!.restart()
      if (restarting.length) {
        logger?.info('restarting the link transports', {
          transports: restarting.join(', '),
          connectedVia: connectedVia().join(', ') || 'none',
        })
        events.add('link', 'restart requested')
      }
    },
    networkChanged: (reason: string) => {
      if (destroyed) return
      for (const slot of slots) {
        const name = slot.name
        if (!slot.checksNetwork || !available().includes(name)) continue
        const transport = created.get(name)!
        events.add(name, `network change (${reason}): checking the connection`)
        transport.networkChanged(reason)
      }
    },
    diagnostics: (): TransportDiagnostics => ({
      transport: mode,
      connected: connectedSubject.value,
      webRtc: diagnosticsOf('webrtc') as TransportDiagnostics['webRtc'],
      iroh: diagnosticsOf('iroh') as TransportDiagnostics['iroh'],
      sendingVia: sendingVia(),
      irohHeldBackForMs: heldBackForMs('iroh') || undefined,
      connects: { ...connects },
      stats: {
        ...stats,
        sent: { ...stats.sent },
        received: { ...stats.received },
      },
      recentEvents: events.list(),
    }),
    releaseIroh: (graceMs: number) => {
      const transport = created.get('iroh')
      if (!transport) return okAsync(undefined)
      const shutdown = transport.shutdown
      const walletGone = firstValueFrom(
        transport.connected$.pipe(
          filter((connected) => !connected),
          timeout({ first: graceMs, with: () => of(false) }),
        ),
        { defaultValue: false },
      )
      logger?.info('releasing the iroh endpoint', { graceMs })
      return ResultAsync.fromSafePromise(walletGone).andThen(() => shutdown())
    },
    destroy: () => {
      if (destroyed) return
      destroyed = true
      updateRunning('link closed')
      password?.fill(0)
      password = undefined
      subscription.unsubscribe()
      for (const transport of created.values()) transport.destroy()
      timers.clearTimeout(holdBackTimer)
      connectedSubject.complete()
      sendingViaSubject.complete()
      onMessageSubject.complete()
    },
  }
}
