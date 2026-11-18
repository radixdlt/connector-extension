import { BehaviorSubject, Subject } from 'rxjs'
import { ResultAsync, errAsync, okAsync } from 'neverthrow'
import { config } from 'config'
import type { AppLogger } from 'utils/logger'
import { LimitedLogger } from 'utils/limited-logger'
import { errorIdentity } from 'utils/error-identity'
import { parseIrohRelayUrl } from 'options/radix-connect-transport'
import {
  messageErrorReasons,
  type SendMessageError,
  type TransportMessage,
  type WalletNotice,
  type WalletTransport,
} from '../wallet-transport'
import {
  getIrohErrorCode,
  type IrohBindings,
  type IrohErrorCode,
  type IrohSession,
  type IrohSessionEvent,
} from './iroh-bindings'
import { ManagedSession } from './managed-session'
import { settleOrTimeout } from './settle'
import { parseIncoming, serialize, toSendMessageError } from './iroh-wire'
import { EndpointRegistry, pageEndpoints } from './endpoint-registry'
import { loadIroh } from './load-iroh'
import {
  toIrohSessionDiagnostics,
  type IrohSessionDiagnostics,
  type IrohTransportDiagnostics,
  type TransportError,
} from '../diagnostics'
import { SessionRuns } from './session-runs'

export type IrohConnectionConfig = {
  /**
   * A custom relay server for the link. `undefined`: n0's public relays (each end
   * uses its closest one and finds the other through n0's address lookup).
   */
  relayUrl?: string
}

export type IrohTransport = WalletTransport<IrohConnectionConfig> & {
  /**
   * Stops connecting and shuts the current session down. Resolves once its endpoint
   * is closed, so that another session for the same password can take over.
   */
  shutdown: () => ResultAsync<void, never>
  diagnostics: () => IrohTransportDiagnostics
  /**
   * The network may have changed (`reason`: `online`, `wake after 42s`...): the
   * session checks its connection to the wallet and drops it at once if it is dead.
   */
  networkChanged: (reason: string) => void
}

/** Errors that a new attempt with the same settings cannot fix. */
const permanentStartErrors = new Set<IrohErrorCode | undefined>([
  'invalidPassword',
  'invalidRelayUrl',
])

const connectionPasswordByteLength = config.secrets.connectionPasswordByteLength

const isSamePassword = (a: Uint8Array | undefined, b: Uint8Array) =>
  !!a && a.length === b.length && a.every((byte, index) => byte === b[index])

/**
 * How long after a wake a dropped connection is taken as dead with the sleep: the check a
 * wake runs drops a dead one when its deadline passes (seconds), and the network takes a
 * few more to come back. A drop later than this is an ordinary one.
 */
const WAKE_RENEWAL_WINDOW_MS = 10_000

/**
 * After a wake, how many times the network is tried (every `wakeProbeIntervalMs`) before
 * renewing anyway: a session started while the network is not up yet cannot measure the
 * relays, and stays without one for seconds (measured: 6.25 s instead of 1.5 s).
 */
const WAKE_NETWORK_PROBES = 30

/** A relay's HTTP probe path (`iroh-relay`'s `RELAY_PROBE_PATH`). */
const RELAY_PROBE_PATH = 'ping'

/** One HTTP request to `url`: true when anything answers (the network is up). */
const fetchAnswers = async (url: string) => {
  try {
    await fetch(url, {
      mode: 'no-cors',
      cache: 'no-store',
      signal: AbortSignal.timeout(1500),
    })
    return true
  } catch {
    return false
  }
}

const localEndpointIdOf = (session: ManagedSession) =>
  session.diagnostics()?.localEndpointId

type StartError = { code?: IrohErrorCode; error: Error }

/**
 * Radix Connect over iroh, `connector` side: owns one `IrohSession` keyed by the
 * link's connection password and exposes it as a `WalletTransport`.
 *
 * The session itself waits for the wallet and handles reconnections. This adapter
 * (re)starts it when the password or the relay changes, retries with a backoff when
 * it cannot start, and never runs two sessions at the same time: a new one starts
 * only after the previous endpoint is closed.
 */
export const IrohTransport = (
  input: {
    logger?: AppLogger
    loadIroh?: () => ResultAsync<IrohBindings, Error>
    ackTimeoutMs?: number
    sendSafetyMarginMs?: number
    startRetryDelayMs?: { initial: number; max: number }
    shutdownTimeoutMs?: number
    logRepeatIntervalMs?: number
    now?: () => number
    /** Sessions running in this page, by local endpoint id (tests use their own). */
    runningEndpoints?: Map<string, number>
    /**
     * The relay the wallet was last seen on (kept with the link): each session
     * knocks there as it starts, so a wallet that is up connects at once.
     */
    walletRelay?: string
    /** The wallet is on another relay than `walletRelay`: keep it with the link. */
    onWalletRelay?: (relayUrl: string) => void
    /**
     * Whether the network answers at `url` (a relay's probe path): after a wake, a
     * session is renewed only once it does. Tests use their own.
     */
    networkAnswers?: (url: string) => Promise<boolean>
    wakeProbeIntervalMs?: number
  } = {},
): IrohTransport => {
  const logger = input.logger
  const now = input.now ?? Date.now
  // Failures that repeat (a relay that stays down...) are logged once a minute.
  const log = LimitedLogger(logger, {
    intervalMs:
      input.logRepeatIntervalMs ?? config.diagnostics.logRepeatInterval,
    now,
  })
  const loadBindings = input.loadIroh ?? loadIroh
  const ackTimeoutMs = input.ackTimeoutMs ?? config.iroh.ackTimeout
  const sendSafetyMarginMs =
    input.sendSafetyMarginMs ?? config.iroh.sendSafetyMargin
  const retryDelay = input.startRetryDelayMs ?? config.iroh.startRetryDelay
  const shutdownTimeoutMs =
    input.shutdownTimeoutMs ?? config.iroh.shutdownTimeout
  const runningEndpoints = input.runningEndpoints
    ? EndpointRegistry(input.runningEndpoints)
    : pageEndpoints

  const connectedSubject = new BehaviorSubject(false)
  const onMessageSubject = new Subject<TransportMessage>()
  const walletNoticeSubject = new Subject<WalletNotice>()

  let password: Uint8Array | undefined
  let relayUrl: string | undefined
  let walletRelay = input.walletRelay
  // An invalid relay URL stops the transport instead of falling back to another relay.
  let isRelayUrlValid = true
  let shouldConnect = false
  let destroyed = false
  let current: ManagedSession | undefined
  // A run of an older generation than the desired session's winds down.
  const runs = SessionRuns({
    retryDelay,
    onRunFailed: (error) =>
      logger?.error('iroh: session loop failed', {
        message: errorIdentity(error)?.message,
      }),
  })

  // Diagnostics: the latest snapshot of the current (or last) session, and this
  // adapter's own last failure.
  let lastSnapshot: IrohSessionDiagnostics | undefined
  let lastError: TransportError | undefined
  let startFailures = 0
  // When the wallet connected (this adapter's clock), while it is connected.
  let connectedAt: number | undefined
  // Why the current session is being closed, for its "closed" line.
  let closeReason: string | undefined
  let reportedMissingNetworkChanged = false
  /** Whether the connected wallet last said its app is in the background. */
  let peerInBackground = false
  /** When the computer last woke from sleep (see `renewIfWokeWithoutRelay`). */
  let wokeAt: number | undefined
  let renewingAfterWake = false
  const networkAnswers = input.networkAnswers ?? fetchAnswers
  const wakeProbeIntervalMs = input.wakeProbeIntervalMs ?? 500
  // Connections that come and go are worth seeing one by one, unless they flap.
  const lifecycleLog = LimitedLogger(logger, {
    intervalMs:
      input.logRepeatIntervalMs ?? config.diagnostics.logRepeatInterval,
    burst: 10,
    now,
  })

  /** Refreshes `lastSnapshot` from `session` and returns its summary line. */
  const summaryOf = (session: ManagedSession) => {
    const snapshot = session.diagnostics()
    if (snapshot) {
      const wasColliding = lastSnapshot?.keyCollision === true
      lastSnapshot = toIrohSessionDiagnostics(snapshot)
      if (lastSnapshot.keyCollision && !wasColliding) {
        lastError = {
          message:
            'another device or browser profile with this link took its place on the relay',
          at: now(),
        }
        log.warn(
          'key-collision',
          "iroh: another device or browser profile with this link took this connector's place on the relay: the wallet cannot reach it until one of them leaves",
          { summary: lastSnapshot.summary },
        )
      }
    }
    return lastSnapshot?.summary
  }

  const recordError = (message: string) => {
    lastError = { message, at: now() }
  }

  const isCurrent = (runGeneration: number) =>
    runs.isLatest(runGeneration) && !destroyed

  const setConnected = (connected: boolean) => {
    if (connectedSubject.value === connected) return
    if (connected) connectedAt = now()
    else connectedAt = undefined
    connectedSubject.next(connected)
  }

  /** How the session reaches the wallet, from its latest snapshot. */
  const connectionDetails = () => ({
    path: lastSnapshot?.path,
    rttMs: lastSnapshot?.rttMs,
    relay: lastSnapshot?.relayUrl ?? (relayUrl ? relayUrl : 'public, none yet'),
    relayConnected: lastSnapshot?.relayConnected,
  })

  const startSession = (
    runGeneration: number,
    sessionPassword: Uint8Array,
    sessionRelayUrl: string | undefined,
  ): ResultAsync<IrohSession, StartError> =>
    loadBindings()
      .mapErr((error): StartError => ({ error }))
      .andThen((bindings) =>
        ResultAsync.fromPromise(
          Promise.resolve().then(() => {
            // A replaced password is zeroed: never start a stale run with it.
            if (!isCurrent(runGeneration))
              throw new Error('the session is no longer wanted')
            return bindings.startSession(
              sessionPassword,
              'connector',
              sessionRelayUrl || undefined,
              ackTimeoutMs,
              walletRelay,
              // The extension's links are its own: no other process holds them.
              true,
            )
          }),
          (error): StartError => ({
            code: getIrohErrorCode(error),
            error: errorIdentity(error),
          }),
        ),
      )

  const onIncomingMessage = (raw: string) => {
    const message = parseIncoming(raw)
    if (message.isOk()) onMessageSubject.next(message.value)
    else
      logger?.warn(`iroh: dropped a message that is ${message.error}`, {
        length: raw.length,
      })
  }

  /**
   * After a wake from sleep, a session neither connected nor on its relay is renewed at
   * once. Its relay connection died with the sleep, and iroh then waits before trying it
   * again (up to 16 s, measured), however soon the network is back; a new session
   * reaches the relay in about a second and knocks for the wallet. Called when the check
   * a wake runs is done, and when the connection drops within `WAKE_RENEWAL_WINDOW_MS`
   * of the wake (a dead connection goes when the check's deadline passes, seconds
   * later). A session that is connected (directly, or the network survived a short
   * sleep) or already back on its relay is left alone.
   */
  const renewIfWokeWithoutRelay = (session: ManagedSession) => {
    if (wokeAt === undefined || now() - wokeAt > WAKE_RENEWAL_WINDOW_MS) return
    if (!worthRenewing(session) || renewingAfterWake) return
    wokeAt = undefined
    renewingAfterWake = true
    // eslint-disable-next-line no-void -- fire-and-forget
    void renewOnceTheNetworkAnswers(session).finally(() => {
      renewingAfterWake = false
    })
  }

  /** Still worth renewing: neither connected nor on its relay (nor replaced). */
  const worthRenewing = (session: ManagedSession) =>
    !destroyed &&
    current === session &&
    shouldConnect &&
    !session.isConnected() &&
    session.diagnostics()?.relayConnected === false

  /**
   * Waits until the network answers at the wallet's relay, then renews `session` if it
   * still needs it (its own relay may come back meanwhile). Without a known relay, at
   * once.
   */
  const renewOnceTheNetworkAnswers = async (session: ManagedSession) => {
    const probe = walletRelay
      ? new URL(RELAY_PROBE_PATH, walletRelay).toString()
      : undefined
    if (probe) {
      for (let tries = 0; tries < WAKE_NETWORK_PROBES; tries++) {
        if (await networkAnswers(probe)) break
        if (!worthRenewing(session)) return
        await new Promise((resolve) => {
          setTimeout(resolve, wakeProbeIntervalMs)
        })
      }
    }
    if (!worthRenewing(session)) return
    restartSession('woke without its relay')
  }

  /** Keeps where the wallet is, for the next session's knock. */
  const keepWalletRelay = (seen: string) => {
    if (seen === walletRelay) return
    walletRelay = seen
    logger?.debug('iroh: the wallet is on another relay, kept for knocking')
    input.onWalletRelay?.(seen)
  }

  /** Asks the session where the connected wallet is (a wallet that does not say it). */
  const noteWalletRelay = async (session: ManagedSession) => {
    const seen = await session.peerRelay()
    if (!seen || current !== session) return
    keepWalletRelay(seen)
  }

  /**
   * What each kind of a session's events does. A new kind in the library does not
   * compile until it is handled here; one unknown at run time is ignored.
   */
  const sessionEventHandlers = (
    session: ManagedSession,
  ): {
    [Type in IrohSessionEvent['type']]: (
      event: Extract<IrohSessionEvent, { type: Type }>,
    ) => void
  } => ({
    stateChanged: (event) => {
      if (current !== session) return
      const connectedForMs =
        connectedAt === undefined ? undefined : now() - connectedAt
      const wasConnected = connectedSubject.value
      setConnected(event.state === 'connected')
      const summary = summaryOf(session)
      if (event.state === 'connected') {
        lifecycleLog.info('connected', 'iroh: the wallet connected', {
          ...connectionDetails(),
          summary,
        })
        // eslint-disable-next-line no-void -- fire-and-forget
        void noteWalletRelay(session)
      } else if (wasConnected) {
        // A wallet that had just started had no relay yet when it connected.
        // eslint-disable-next-line no-void -- fire-and-forget
        void noteWalletRelay(session)
        renewIfWokeWithoutRelay(session)
        // The session says why (the wallet closed it, replaced it with a newer
        // connection, the network dropped it...).
        lifecycleLog.info('disconnected', 'iroh: the wallet disconnected', {
          reason: lastSnapshot?.lastError ?? 'unknown',
          connectedForMs,
          state: event.state,
          summary,
        })
        // Gone to the background, then silent: its app was closed (swiped away, or
        // ended by the system), not merely paused.
        if (
          peerInBackground &&
          lastSnapshot?.lastError?.includes('no answer to a liveness check')
        ) {
          logger?.info('iroh: the wallet app was closed')
          walletNoticeSubject.next({ type: 'walletClosed' })
        }
      } else {
        log.info(
          `state:${event.state}:${lastSnapshot?.lastError}`,
          `iroh: ${event.state}`,
          { summary },
        )
      }
    },
    // Taking it confirmed it to the wallet: deliver it even if a restart is pending.
    message: (event) => onIncomingMessage(event.message),
    requestRedelivered: (event) => {
      logger?.info(
        'iroh: a request the wallet lost was delivered to it again',
        {
          interactionId: event.interactionId,
        },
      )
      walletNoticeSubject.next(event)
    },
    // The wallet said which relay it is on, whenever it gets one or moves.
    peerRelay: (event) => {
      if (current !== session) return
      keepWalletRelay(event.relayUrl)
    },
    peerPresence: (event) => {
      if (current !== session) return
      peerInBackground = event.inBackground
      // Seconds after connecting: a wallet that had just started has its relay by now.
      // eslint-disable-next-line no-void -- fire-and-forget
      void noteWalletRelay(session)
      walletNoticeSubject.next({
        type: 'presence',
        inBackground: event.inBackground,
      })
    },
  })

  /** Reads the session's events until it is shut down. */
  const pumpEvents = async (session: ManagedSession) => {
    const handlers = sessionEventHandlers(session)
    for (;;) {
      let event: IrohSessionEvent | undefined
      try {
        event = await session.nextEvent()
      } catch (error) {
        logger?.warn('iroh: reading session events failed', {
          code: getIrohErrorCode(error),
        })
        return
      }
      if (!event) return
      const handle = handlers[event.type] as
        | ((event: IrohSessionEvent) => void)
        | undefined
      handle?.(event)
    }
  }

  const runSessions = async (
    runGeneration: number,
    sessionPassword: Uint8Array,
    sessionRelayUrl: string | undefined,
  ) => {
    let failures = 0
    while (isCurrent(runGeneration)) {
      const startingAt = now()
      const started = await startSession(
        runGeneration,
        sessionPassword,
        sessionRelayUrl,
      )

      if (started.isErr()) {
        if (!isCurrent(runGeneration)) return
        const { code, error } = started.error
        startFailures += 1
        recordError(`could not start the session: ${error.message}`)
        if (permanentStartErrors.has(code)) {
          log.error(
            `start:${code}:${error.message}`,
            'iroh: cannot start the session, not retrying',
            { code, message: error.message },
          )
          return
        }
        failures += 1
        const retryInMs = runs.backoff(failures)
        log.warn(
          `start:${code}:${error.message}`,
          'iroh: could not start the session, retrying',
          { code, message: error.message, retryInMs, startFailures },
        )
        await runs.wait(retryInMs)
        continue
      }

      const session = ManagedSession(started.value, {
        shutdownTimeoutMs,
        logger,
      })

      if (!isCurrent(runGeneration)) {
        // Restarted or destroyed while starting.
        await session.close()
        return
      }

      failures = 0
      startFailures = 0
      current = session
      closeReason = undefined
      setConnected(session.isConnected())
      const startedAt = now()
      lifecycleLog.info(
        'started',
        'iroh: session started, waiting for the wallet',
        {
          startMs: startedAt - startingAt,
          relay: sessionRelayUrl || 'public',
          summary: summaryOf(session),
        },
      )
      const endpointId = localEndpointIdOf(session)
      if (endpointId) {
        const holders = runningEndpoints.hold(endpointId)
        if (holders > 1)
          log.warn(
            'duplicate-endpoint',
            "iroh: this link's endpoint is already running in this page: the two sessions hold the same key and displace each other",
            { sessions: holders, summary: lastSnapshot?.summary },
          )
      }

      await pumpEvents(session)

      if (current === session) {
        current = undefined
        setConnected(false)
      }
      const summary = summaryOf(session)
      await session.close()
      if (endpointId) runningEndpoints.release(endpointId)
      const sessionMs = now() - startedAt

      if (isCurrent(runGeneration)) {
        // The session ended without being asked to: start a new one.
        failures += 1
        recordError('the session ended unexpectedly')
        const retryInMs = runs.backoff(failures)
        log.warn(
          'ended',
          'iroh: the session ended unexpectedly, restarting it',
          { sessionMs, retryInMs, summary },
        )
        await runs.wait(retryInMs)
      } else {
        lifecycleLog.info('closed', 'iroh: session closed', {
          reason: closeReason ?? 'unknown',
          sessionMs,
        })
      }
    }
  }

  /** Applies the desired state: stops the current session, starts a new one. */
  const restartSession = (reason: string) => {
    const runGeneration = runs.next()

    const previous = current
    current = undefined
    setConnected(false)
    if (previous) {
      closeReason = reason
      logger?.info(`iroh: closing the session (${reason})`, {
        summary: summaryOf(previous),
      })
      previous.shutdown()
    }

    const sessionPassword = password
    const sessionRelayUrl = relayUrl
    const shouldRun =
      !destroyed && shouldConnect && isRelayUrlValid && !!sessionPassword

    return runs.chain(() =>
      shouldRun && sessionPassword && isCurrent(runGeneration)
        ? runSessions(runGeneration, sessionPassword, sessionRelayUrl)
        : undefined,
    )
  }

  /**
   * The session's ack timeout (`ackTimeoutMs`, the value callers pass as
   * `options.timeout`) decides when a send times out, and the library then gives up
   * on the message, so a retry cannot deliver it twice. The timer here is only a
   * safety net in case the library never settles the call.
   */
  const sendMessage = (
    message: TransportMessage,
  ): ResultAsync<undefined, SendMessageError> => {
    const session = current
    if (!session || !connectedSubject.value)
      return errAsync({ reason: messageErrorReasons.notConnected })

    return serialize(message).asyncAndThen((json) =>
      ResultAsync.fromPromise(
        settleOrTimeout(session.send(json), ackTimeoutMs + sendSafetyMarginMs),
        toSendMessageError,
      )
        .map(() => undefined)
        .mapErr((error) => {
          const code = getIrohErrorCode(error.jsError)
          recordError(`sending a message failed: ${error.reason} (${code})`)
          log.warn(
            `send:${error.reason}:${code}`,
            'iroh: sending a message failed',
            {
              reason: error.reason,
              code,
              bytes: json.length,
              ...(error.reason === messageErrorReasons.timeout
                ? { ackTimeoutMs, safetyMarginMs: sendSafetyMarginMs }
                : {}),
              summary: summaryOf(session),
            },
          )
          return error
        }),
    )
  }

  /** Zeroes our copy of the password once it is replaced or no longer needed. */
  const forgetPassword = () => {
    password?.fill(0)
    password = undefined
  }

  return {
    connected$: connectedSubject.asObservable(),
    onMessage$: onMessageSubject.asObservable(),
    walletNotices$: walletNoticeSubject.asObservable(),
    reportsRequests: () => current?.peerReportsRequests() ?? false,
    forgetRequest: (interactionId: string) =>
      current?.forgetRequest(interactionId),
    setConnectionPassword: (buffer: Buffer) => {
      if (destroyed) return okAsync(undefined)
      if (buffer.length !== connectionPasswordByteLength) {
        // Never keep a session keyed by a password the link no longer has.
        recordError('invalid connection password')
        if (password) {
          forgetPassword()
          restartSession('invalid connection password')
        }
        return errAsync(
          new Error(
            `the connection password must be ${connectionPasswordByteLength} bytes`,
          ),
        )
      }
      if (!isSamePassword(password, buffer)) {
        const previous = password
        password = Uint8Array.from(buffer)
        restartSession('new connection password')
        // The run using it winds down: it no longer starts sessions with it.
        previous?.fill(0)
      }
      return okAsync(undefined)
    },
    setConnectionConfig: (connectionConfig: IrohConnectionConfig) => {
      const parsed = parseIrohRelayUrl(connectionConfig.relayUrl)
      if (parsed.isErr()) {
        recordError(`invalid relay URL: ${parsed.error}`)
        log.error('relay-url', 'iroh: invalid relay URL, not connecting', {
          reason: parsed.error,
        })
      }
      const nextRelayUrl = parsed.unwrapOr(undefined)
      const nextIsRelayUrlValid = parsed.isOk()
      if (
        nextRelayUrl !== relayUrl ||
        nextIsRelayUrlValid !== isRelayUrlValid
      ) {
        relayUrl = nextRelayUrl
        isRelayUrlValid = nextIsRelayUrlValid
        if (!destroyed) restartSession('relay changed')
      }
    },
    sendMessage,
    connect: () => {
      if (destroyed || shouldConnect) return
      shouldConnect = true
      restartSession('connect')
    },
    disconnect: () => {
      if (destroyed || !shouldConnect) return
      shouldConnect = false
      restartSession('disconnect')
    },
    // Sent when the computer becomes active again. The session reconnects by
    // itself, so a working connection is kept, and so is a session on its relay:
    // the wallet can reach it, and it knocks for the wallet when its relay comes
    // back (renewing it then only started over: 3 s lost after a wake). A session
    // without its relay is renewed: a new one reaches it sooner than the old one
    // retries.
    restart: () => {
      if (destroyed || !shouldConnect || connectedSubject.value) return
      if (current?.diagnostics()?.relayConnected) return
      restartSession('restart requested')
    },
    shutdown: () => {
      shouldConnect = false
      return ResultAsync.fromSafePromise(restartSession('shutdown'))
    },
    networkChanged: (reason: string) => {
      const session = current
      if (destroyed || !session) {
        logger?.debug('iroh: network change, no session to check', { reason })
        return
      }
      if (!session.supportsNetworkChanged()) {
        if (!reportedMissingNetworkChanged)
          logger?.info(
            'iroh: network change, but this iroh library cannot check the connection; it waits for the idle timeout',
            { reason },
          )
        reportedMissingNetworkChanged = true
        return
      }
      if (reason.startsWith('wake')) wokeAt = now()
      // The session's own state: it changes as soon as it drops the connection.
      const wasConnected = session.isConnected()
      const startedAt = now()
      logger?.info('iroh: network change, checking the connection', {
        reason,
        connected: wasConnected,
      })
      session.networkChanged().then(
        () => {
          const connected = session.isConnected()
          logger?.info('iroh: connection checked after a network change', {
            reason,
            durationMs: now() - startedAt,
            connected,
            ...(wasConnected && !connected
              ? { outcome: 'dead connection dropped' }
              : {}),
          })
          renewIfWokeWithoutRelay(session)
        },
        (error) => {
          log.warn(
            `network-changed:${getIrohErrorCode(error)}`,
            'iroh: checking the connection after a network change failed',
            { reason, code: getIrohErrorCode(error) },
          )
        },
      )
    },
    diagnostics: (): IrohTransportDiagnostics => {
      if (current) summaryOf(current)
      return {
        connected: connectedSubject.value,
        connectedForMs:
          connectedAt === undefined ? undefined : now() - connectedAt,
        configuredRelayUrl: relayUrl,
        relayUrlValid: isRelayUrlValid,
        session: lastSnapshot,
        lastError,
        startFailures,
      }
    },
    destroy: () => {
      if (destroyed) return
      destroyed = true
      restartSession('destroyed')
      forgetPassword()
      connectedSubject.complete()
      onMessageSubject.complete()
    },
  }
}
