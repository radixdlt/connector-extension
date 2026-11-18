import {
  BehaviorSubject,
  Observable,
  Subject,
  Subscription,
  filter,
  firstValueFrom,
  of,
  timeout,
} from 'rxjs'
import { ResultAsync, errAsync, okAsync } from 'neverthrow'
import type { AppLogger } from 'utils/logger'
import { config as appConfig } from 'config'
import { LimitedLogger } from 'utils/limited-logger'
import type { RadixConnectTransport } from 'options/radix-connect-transport'
import {
  messageErrorReasons,
  type MessageErrorReason,
  type SendMessageError,
  type TransportMessage,
  type WalletNotice,
  type WalletTransport,
} from './wallet-transport'
import type { TransportName } from './diagnostics'
import { IncomingDuplicates } from './incoming-duplicates'
import { sendOrderOf } from './send-order'
import type {
  LinkTransport,
  TransportConnectionConfig,
  TransportSlot,
} from './transport-slots'

export type { TransportConnectionConfig } from './transport-slots'

/** How the composite's own log lines name a message: its kind and request id. */
const messageSummary = (message: TransportMessage) => {
  const summary: Record<string, string> = {}
  if (typeof message.discriminator === 'string')
    summary.discriminator = message.discriminator
  if (typeof message.interactionId === 'string')
    summary.interactionId = message.interactionId
  return summary
}

export type CompositeTransport = WalletTransport<TransportConnectionConfig> & {
  /**
   * Lets the wallet finish on iroh, then closes the iroh endpoint: waits until the
   * wallet closed its iroh connection (at most `graceMs`), then shuts the iroh
   * session down. Resolves once its endpoint is closed, so that another one for the
   * same password can take over. WebRTC is not affected.
   */
  releaseIroh: (graceMs: number) => ResultAsync<void, never>
  /** The network may have changed: iroh checks its connection (see `IrohTransport`). */
  networkChanged: (reason: string) => void
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

/**
 * The transports selected by the `radixConnectTransport` option, behind one
 * `WalletTransport`. Each link keeps every selected transport running; none is
 * chosen once and for all:
 *
 * - `connected$` is true while any selected transport is connected,
 * - `onMessage$` merges the messages of all of them; with several transports,
 *   without the copy of a message the wallet sent over another one (identical to
 *   one received within `incomingDuplicateWindowMs` via another transport),
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
 * With WebRTC alone it adds nothing to what the WebRTC transport does, logs
 * included. With iroh it logs (through the link's logger) which transports run and
 * why, the link's merged state, fallbacks, hold-backs and dropped duplicates (ids
 * only, never contents).
 */
export const CompositeTransport = (input: {
  /** The link's transports, by preference (see `transportSlots`). */
  slots: TransportSlot[]
  logger?: AppLogger
  irohHoldBackMs?: number
  incomingDuplicateWindowMs?: number
  now?: () => number
}): CompositeTransport => {
  const { logger } = input
  const now = input.now ?? Date.now
  const holdBackMs =
    input.irohHoldBackMs ?? appConfig.transport.irohHoldBackAfterFailure
  const duplicateWindowMs =
    input.incomingDuplicateWindowMs ??
    appConfig.transport.incomingDuplicateWindow
  const intervalMs = appConfig.diagnostics.logRepeatInterval
  const log = LimitedLogger(logger, { intervalMs, now })
  // State changes are worth seeing one by one, unless the link flaps.
  const stateLog = LimitedLogger(logger, { intervalMs, burst: 10, now })

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
  const duplicates = IncomingDuplicates({ windowMs: duplicateWindowMs, now })

  const connectedSubject = new BehaviorSubject(false)
  const onMessageSubject = new Subject<TransportMessage>()
  const walletNoticeSubject = new Subject<WalletNotice>()
  const subscription = new Subscription()

  const isConnected = (name: TransportName) => !!connectedState.get(name)

  const isSelected = (name: TransportName) =>
    !!mode && slotOf(name).isSelectedBy(mode)
  const selected = (): TransportName[] =>
    slots.map((slot) => slot.name).filter(isSelected)
  /** Selected, and created: the transports that may be used now. */
  const available = () => selected().filter((name) => created.has(name))
  /** WebRTC alone: the link behaves, and logs, as without this composite. */
  const webRtcOnly = () => selected().join() === 'webrtc'

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
    if (viaText !== lastVia && !webRtcOnly()) {
      const details = {
        state: via.length ? 'connected' : 'not connected',
        via: viaText,
        sendingVia: sendingVia() ?? 'none',
        previously: lastVia,
        mode,
      }
      stateLog.info('state', 'link state changed', details)
    }
    lastVia = viaText
    const connected = via.length > 0
    if (connected !== connectedSubject.value) connectedSubject.next(connected)
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
    if (connected !== was && !webRtcOnly()) {
      if (connected && heldBackUntil.get(name)) {
        // A new connection: it is preferred again.
        heldBackUntil.delete(name)
        logger?.info(`${name} reconnected: preferred again for sending`)
      } else if (!connected) {
        const reason = disconnectReason(name)
        logger?.info(`${name} disconnected`, reason ? { reason } : undefined)
      }
    }
    updateConnected()
  }

  /**
   * Delivers a message from the wallet, unless several transports are selected and
   * it is the copy of one received lately via another transport. With one transport
   * every message is delivered, as without this composite.
   */
  const onIncoming = (via: TransportName) => (message: TransportMessage) => {
    if (selected().length < 2) {
      onMessageSubject.next(message)
      return
    }
    const { first, time } = duplicates.check(message, via)
    if (first && first.via !== via) {
      log.info(
        `duplicate:${via}:${first.via}`,
        'dropped a duplicate message from the wallet',
        {
          via,
          firstVia: first.via,
          sinceFirstMs: time - first.at,
          windowMs: duplicateWindowMs,
          ...messageSummary(message),
        },
      )
      return
    }
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
    if (
      next.join() === 'webrtc' ||
      (!next.length && stopped.join() === 'webrtc')
    )
      return
    logger?.info('link transports changed', {
      mode,
      running: next.join(', ') || 'none',
      started: started.join(', ') || 'none',
      stopped: stopped.join(', ') || 'none',
      reason,
    })
  }

  /** After a failure where the wallet may have it: the others send for a while. */
  const holdBack = (
    via: TransportName,
    error: SendMessageError,
    description: Record<string, string>,
  ) => {
    const others = selected().filter((name) => name !== via)
    if (!slotOf(via).preferred || !others.length) return
    heldBackUntil.set(via, now() + holdBackMs)
    const othersText = others.map((name) => slotOf(name).label).join(', ')
    log.warn(
      `${via}-held-back:${error.reason}`,
      `${via} did not deliver a message; not resent now (the wallet may have received it), the next messages go over ${othersText} while it is connected`,
      {
        reason: error.reason,
        code: errorCode(error),
        holdBackMs,
        ...description,
      },
    )
  }

  const sendMessage = (
    message: TransportMessage,
    options?: { timeout?: number },
  ): ResultAsync<undefined, SendMessageError> => {
    const order = sendOrder()

    const attempt = (
      index: number,
    ): ResultAsync<undefined, SendMessageError> => {
      const via = order[index]
      if (!via) return errAsync({ reason: messageErrorReasons.notConnected })
      return created
        .get(via)!
        .sendMessage(message, options)
        .orElse((error) => {
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
                ...messageSummary(message),
              },
            )
            return attempt(index + 1)
          }
          if (!nothingWasSent(error.reason))
            holdBack(via, error, messageSummary(message))
          return errAsync(error)
        })
    }

    return attempt(0)
  }

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
      if (restarting.length && !webRtcOnly())
        logger?.info('restarting the link transports', {
          transports: restarting.join(', '),
          connectedVia: connectedVia().join(', ') || 'none',
        })
    },
    networkChanged: (reason: string) => {
      if (destroyed) return
      for (const slot of slots) {
        const name = slot.name
        if (!slot.checksNetwork || !available().includes(name)) continue
        created.get(name)!.networkChanged(reason)
      }
    },
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
      connectedSubject.complete()
      onMessageSubject.complete()
      walletNoticeSubject.complete()
    },
  }
}
