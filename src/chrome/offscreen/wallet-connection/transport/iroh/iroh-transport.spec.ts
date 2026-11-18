import { describe, it, expect, vi } from 'vitest'
import { errAsync, okAsync, ResultAsync } from 'neverthrow'
import type { AppLogger } from 'utils/logger'
import { IrohTransport } from './iroh-transport'
import type { IrohDiagnostics } from '@genkipool/radix-connect-iroh'
import type { WalletNotice } from '../wallet-transport'
import type {
  IrohBindings,
  IrohConnectionState,
  IrohErrorCode,
  IrohSession,
  IrohSessionEvent,
} from './iroh-bindings'

const password = Buffer.alloc(32, 7)
const otherPassword = Buffer.alloc(32, 9)

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

const irohError = (code: IrohErrorCode) =>
  Object.assign(new Error(`iroh error: ${code}`), { code })

const deferred = <T>() => {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const FakeSession = (initialState: IrohConnectionState = 'disconnected') => {
  const queued: (IrohSessionEvent | undefined)[] = []
  let waiting: ((event: IrohSessionEvent | undefined) => void) | undefined
  let closed = false
  let state = initialState
  let lastError: string | undefined
  let relayConnected = true

  const push = (event: IrohSessionEvent | undefined) => {
    if (waiting) {
      const resolve = waiting
      waiting = undefined
      resolve(event)
    } else {
      queued.push(event)
    }
  }

  const session = {
    state: vi.fn(() => state),
    send: vi.fn<IrohSession['send']>(() => Promise.resolve()),
    nextEvent: vi.fn((): Promise<IrohSessionEvent | undefined> => {
      if (closed) return Promise.resolve(undefined)
      if (queued.length) return Promise.resolve(queued.shift())
      return new Promise((resolve) => {
        waiting = resolve
      })
    }),
    shutdown: vi.fn(async () => {
      closed = true
      push(undefined)
    }),
    free: vi.fn(),
    networkChanged: vi.fn<NonNullable<IrohSession['networkChanged']>>(
      async () => undefined,
    ),
    peerRelay: vi.fn<NonNullable<IrohSession['peerRelay']>>(
      async () => 'https://wallet-relay.example.com/',
    ),
    diagnostics: vi.fn(
      (): IrohDiagnostics => ({
        role: 'connector',
        localEndpointId: 'c0ffee'.repeat(10),
        peerEndpointId: 'beef00'.repeat(10),
        relayUrl: 'https://relay.example.com/',
        publicRelays: false,
        relayConnected,
        state,
        path: state === 'connected' ? 'direct' : undefined,
        rttMs: state === 'connected' ? 42 : undefined,
        failedAttempts: 0,
        keyCollision: false,
        lastError,
        summary: `connector c0ffeec0ff → beef00beef state=${state}${
          lastError ? ` last_error="${lastError}"` : ''
        }`,
      }),
    ),
  }

  return {
    session,
    setLastError: (error: string) => {
      lastError = error
    },
    setRelayConnected: (connected: boolean) => {
      relayConnected = connected
    },
    setState: (next: IrohConnectionState) => {
      state = next
      push({ type: 'stateChanged', state: next })
    },
    receive: (message: string) => push({ type: 'message', message }),
    /** Any other session event, as the library sends it. */
    notify: (event: IrohSessionEvent) => push(event),
    reportsRequests: (reports: boolean) => {
      ;(session as IrohSession).peerReportsRequests = () => reports
    },
    /** Ends the event stream without a shutdown, as if the session died. */
    end: () => push(undefined),
  }
}

type FakeSession = ReturnType<typeof FakeSession>

const createTestSuite = (
  options: {
    startSession?: IrohBindings['startSession']
    loadIroh?: () => ResultAsync<IrohBindings, Error>
    ackTimeoutMs?: number
    walletRelay?: string
    onWalletRelay?: (relayUrl: string) => void
    /** Applied to each new session before the transport gets it. */
    configureSession?: (fake: FakeSession) => void
    now?: () => number
    networkAnswers?: (url: string) => Promise<boolean>
  } = {},
) => {
  const sessions: FakeSession[] = []
  const startSession = vi.fn<IrohBindings['startSession']>(
    options.startSession ??
      (async () => {
        const fake = FakeSession()
        options.configureSession?.(fake)
        sessions.push(fake)
        return fake.session
      }),
  )
  const bindings: IrohBindings = {
    startSession,
    publicRelayUrls: () => ['https://public-relay.example.com/'],
    validateRelayUrl: () => undefined,
  }
  const logger = {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
  }
  const transport = IrohTransport({
    logger: logger as unknown as AppLogger,
    loadIroh: options.loadIroh ?? (() => okAsync(bindings)),
    ackTimeoutMs: options.ackTimeoutMs ?? 500,
    sendSafetyMarginMs: 20,
    startRetryDelayMs: { initial: 5, max: 20 },
    shutdownTimeoutMs: 200,
    runningEndpoints: new Map(),
    walletRelay: options.walletRelay,
    onWalletRelay: options.onWalletRelay,
    ...(options.now ? { now: options.now } : {}),
    ...(options.networkAnswers
      ? { networkAnswers: options.networkAnswers, wakeProbeIntervalMs: 5 }
      : {}),
  })
  const connected: boolean[] = []
  const messages: Record<string, any>[] = []
  transport.connected$.subscribe((value) => connected.push(value))
  transport.onMessage$.subscribe((message) => messages.push(message))

  const lastSession = () => sessions[sessions.length - 1]

  const connectedSession = async () => {
    transport.setConnectionPassword(password)
    transport.connect()
    await vi.waitFor(() => expect(sessions).toHaveLength(1))
    sessions[0].setState('connected')
    await vi.waitFor(() => expect(connected.at(-1)).toBe(true))
    return sessions[0]
  }

  return {
    transport,
    startSession,
    sessions,
    lastSession,
    logger,
    connected,
    messages,
    connectedSession,
  }
}

describe('IrohTransport', () => {
  describe('knocking where the wallet is', () => {
    it('starts each session with the relay its wallet was last seen on', async () => {
      const { startSession, connectedSession } = createTestSuite({
        walletRelay: 'https://stored-relay.example.com/',
      })
      await connectedSession()
      expect(startSession.mock.calls[0][4]).toBe(
        'https://stored-relay.example.com/',
      )
    })

    it("starts every session as its link's only holder", async () => {
      const { startSession, connectedSession } = createTestSuite()
      await connectedSession()
      // A reload ends the old run without closing: the wallet drops that connection at once.
      expect(startSession.mock.calls[0][5]).toBe(true)
    })

    it('keeps a new relay of the wallet, tells it once, and starts the next session with it', async () => {
      const onWalletRelay = vi.fn()
      const { transport, startSession, connectedSession, sessions } =
        createTestSuite({
          walletRelay: 'https://stored-relay.example.com/',
          onWalletRelay,
        })
      await connectedSession()
      await vi.waitFor(() =>
        expect(onWalletRelay).toHaveBeenCalledWith(
          'https://wallet-relay.example.com/',
        ),
      )

      sessions[0].end()
      await vi.waitFor(() => expect(startSession).toHaveBeenCalledTimes(2))
      expect(startSession.mock.calls[1][4]).toBe(
        'https://wallet-relay.example.com/',
      )
      sessions[1].setState('connected')
      await sleep(20)
      expect(onWalletRelay).toHaveBeenCalledTimes(1)
      transport.destroy()
    })

    // A wallet that had just started: no relay yet when it connected.
    const withoutRelayYet = (fake: FakeSession) =>
      fake.session.peerRelay.mockResolvedValue(undefined)

    it("keeps the relay of a wallet that had none yet when it connected, once it tells its app's presence", async () => {
      const onWalletRelay = vi.fn()
      const { connectedSession } = createTestSuite({
        configureSession: withoutRelayYet,
        onWalletRelay,
      })
      const fake = await connectedSession()
      await vi.waitFor(() => expect(fake.session.peerRelay).toHaveBeenCalled())
      await sleep(20)
      expect(onWalletRelay).not.toHaveBeenCalled()

      fake.session.peerRelay.mockResolvedValue(
        'https://wallet-relay.example.com/',
      )
      fake.notify({ type: 'peerPresence', inBackground: true })

      await vi.waitFor(() =>
        expect(onWalletRelay).toHaveBeenCalledWith(
          'https://wallet-relay.example.com/',
        ),
      )
    })

    it('keeps the relay of the wallet when its connection ends', async () => {
      const onWalletRelay = vi.fn()
      const { connectedSession } = createTestSuite({
        configureSession: withoutRelayYet,
        onWalletRelay,
      })
      const fake = await connectedSession()
      await sleep(20)
      expect(onWalletRelay).not.toHaveBeenCalled()
      fake.session.peerRelay.mockResolvedValue(
        'https://wallet-relay.example.com/',
      )

      fake.setState('connecting')

      await vi.waitFor(() =>
        expect(onWalletRelay).toHaveBeenCalledWith(
          'https://wallet-relay.example.com/',
        ),
      )
    })

    it('keeps the relay the wallet says it is on, whenever it says it', async () => {
      const onWalletRelay = vi.fn()
      const { connectedSession } = createTestSuite({
        configureSession: withoutRelayYet,
        onWalletRelay,
      })
      const fake = await connectedSession()

      fake.notify({
        type: 'peerRelay',
        relayUrl: 'https://told-relay.example.com/',
      })

      await vi.waitFor(() =>
        expect(onWalletRelay).toHaveBeenCalledWith(
          'https://told-relay.example.com/',
        ),
      )
    })

    it('tells that the wallet app was closed when it went to the background, then stopped answering', async () => {
      const { transport, connectedSession } = createTestSuite()
      const notices: WalletNotice[] = []
      transport.walletNotices$?.subscribe((notice) => notices.push(notice))
      const fake = await connectedSession()
      fake.notify({ type: 'peerPresence', inBackground: true })
      await sleep(10)

      fake.setLastError('connection ended: no answer to a liveness check')
      fake.setState('disconnected')

      await vi.waitFor(() =>
        expect(notices).toContainEqual({ type: 'walletClosed' }),
      )
    })

    it('tells no closed app for a wallet in the foreground, or one that closed the connection', async () => {
      const { transport, connectedSession } = createTestSuite()
      const notices: WalletNotice[] = []
      transport.walletNotices$?.subscribe((notice) => notices.push(notice))
      const fake = await connectedSession()
      // In the foreground and silent: a network problem, maybe; the periodic check handles it.
      fake.setLastError('connection ended: no answer to a liveness check')
      fake.setState('disconnected')
      await sleep(20)

      expect(notices).not.toContainEqual({ type: 'walletClosed' })
    })

    it('says nothing when the wallet is where it was', async () => {
      const onWalletRelay = vi.fn()
      const { connectedSession } = createTestSuite({
        walletRelay: 'https://wallet-relay.example.com/',
        onWalletRelay,
      })
      const fake = await connectedSession()
      await vi.waitFor(() => expect(fake.session.peerRelay).toHaveBeenCalled())
      await sleep(20)
      expect(onWalletRelay).not.toHaveBeenCalled()
    })
  })

  describe('session lifecycle', () => {
    it('starts a connector session with the link password and relay once connected', async () => {
      const { transport, startSession } = createTestSuite()

      transport.setConnectionPassword(password)
      transport.setConnectionConfig({ relayUrl: 'https://relay.example.com' })
      await sleep(20)
      expect(startSession).not.toHaveBeenCalled()

      transport.connect()

      await vi.waitFor(() => expect(startSession).toHaveBeenCalledTimes(1))
      const [sessionPassword, role, relayUrl, ackTimeoutMs] =
        startSession.mock.calls[0]
      expect(Buffer.from(sessionPassword).equals(password)).toBe(true)
      expect(role).toBe('connector')
      expect(relayUrl).toBe('https://relay.example.com/')
      expect(ackTimeoutMs).toBe(500)
    })

    it("uses n0's public relays when no relay is configured", async () => {
      const { transport, startSession } = createTestSuite()

      transport.setConnectionConfig({ relayUrl: '' })
      transport.setConnectionPassword(password)
      transport.connect()

      await vi.waitFor(() => expect(startSession).toHaveBeenCalledTimes(1))
      expect(startSession.mock.calls[0][2]).toBeUndefined()
    })

    it('does not start without a password', async () => {
      const { transport, startSession } = createTestSuite()

      transport.connect()
      await sleep(20)

      expect(startSession).not.toHaveBeenCalled()
    })

    it('keeps its own copy of the password', async () => {
      const { transport, startSession } = createTestSuite()
      const buffer = Buffer.from(password)

      transport.setConnectionPassword(buffer)
      buffer.fill(0)
      transport.connect()

      await vi.waitFor(() => expect(startSession).toHaveBeenCalledTimes(1))
      expect(Buffer.from(startSession.mock.calls[0][0]).equals(password)).toBe(
        true,
      )
    })

    it('rejects a password that is not 32 bytes and stops the current session', async () => {
      const { transport, connectedSession, startSession, connected } =
        createTestSuite()
      const fake = await connectedSession()

      const result = await transport.setConnectionPassword(Buffer.alloc(16))

      expect(result.isErr()).toBe(true)
      await vi.waitFor(() => expect(fake.session.shutdown).toHaveBeenCalled())
      expect(connected.at(-1)).toBe(false)
      await sleep(20)
      expect(startSession).toHaveBeenCalledTimes(1)
      expect(startSession.mock.calls[0][0].every((byte) => byte === 0)).toBe(
        true,
      )
    })

    it('zeroes its copy of a replaced password', async () => {
      const { transport, connectedSession, startSession } = createTestSuite()
      await connectedSession()
      const firstCopy = startSession.mock.calls[0][0]

      transport.setConnectionPassword(otherPassword)

      expect(firstCopy.every((byte) => byte === 0)).toBe(true)
      await vi.waitFor(() => expect(startSession).toHaveBeenCalledTimes(2))
      expect(
        Buffer.from(startSession.mock.calls[1][0]).equals(otherPassword),
      ).toBe(true)
    })

    it('zeroes its copy of the password when destroyed', async () => {
      const { transport, connectedSession, startSession } = createTestSuite()
      await connectedSession()

      transport.destroy()

      expect(startSession.mock.calls[0][0].every((byte) => byte === 0)).toBe(
        true,
      )
    })

    it('never starts a session with a password replaced while loading', async () => {
      const fake = FakeSession()
      const startSession = vi.fn<IrohBindings['startSession']>(
        async () => fake.session,
      )
      const loaded = deferred<IrohBindings>()
      const { transport } = createTestSuite({
        startSession,
        loadIroh: () => ResultAsync.fromSafePromise(loaded.promise),
      })

      transport.setConnectionPassword(password)
      transport.connect()
      transport.setConnectionPassword(otherPassword)
      loaded.resolve({
        startSession,
        publicRelayUrls: () => ['https://public-relay.example.com/'],
        validateRelayUrl: () => undefined,
      })

      await vi.waitFor(() => expect(startSession).toHaveBeenCalled())
      await sleep(20)
      expect(startSession).toHaveBeenCalledTimes(1)
      expect(
        Buffer.from(startSession.mock.calls[0][0]).equals(otherPassword),
      ).toBe(true)
    })

    it('ignores the same password', async () => {
      const { transport, connectedSession, startSession } = createTestSuite()
      const fake = await connectedSession()

      transport.setConnectionPassword(Buffer.from(password))
      await sleep(20)

      expect(fake.session.shutdown).not.toHaveBeenCalled()
      expect(startSession).toHaveBeenCalledTimes(1)
    })

    it('starts the session for a new password only after the previous endpoint is closed', async () => {
      const { transport, connectedSession, startSession, sessions } =
        createTestSuite()
      const fake = await connectedSession()
      const shutdown = deferred<undefined>()
      fake.session.shutdown.mockImplementation(() => shutdown.promise)

      transport.setConnectionPassword(otherPassword)
      await sleep(20)
      expect(fake.session.shutdown).toHaveBeenCalled()
      expect(startSession).toHaveBeenCalledTimes(1)

      shutdown.resolve(undefined)
      fake.end()

      await vi.waitFor(() => expect(startSession).toHaveBeenCalledTimes(2))
      expect(
        Buffer.from(startSession.mock.calls[1][0]).equals(otherPassword),
      ).toBe(true)
      await vi.waitFor(() => expect(fake.session.free).toHaveBeenCalled())
      expect(sessions).toHaveLength(2)
    })

    it('restarts the session when the relay changes', async () => {
      const { transport, connectedSession, startSession } = createTestSuite()
      const fake = await connectedSession()

      transport.setConnectionConfig({ relayUrl: 'https://other.example.com' })

      await vi.waitFor(() => expect(startSession).toHaveBeenCalledTimes(2))
      expect(fake.session.shutdown).toHaveBeenCalled()
      expect(startSession.mock.calls[1][2]).toBe('https://other.example.com/')
    })

    it('keeps a connected session on restart', async () => {
      const { transport, connectedSession, startSession } = createTestSuite()
      const fake = await connectedSession()

      transport.restart()
      await sleep(20)

      expect(fake.session.shutdown).not.toHaveBeenCalled()
      expect(startSession).toHaveBeenCalledTimes(1)
    })

    it('renews a session that waits for the wallet without its relay on restart', async () => {
      const { transport, startSession, sessions } = createTestSuite()
      transport.setConnectionPassword(password)
      transport.connect()
      await vi.waitFor(() => expect(sessions).toHaveLength(1))
      sessions[0].setRelayConnected(false)

      transport.restart()

      await vi.waitFor(() => expect(startSession).toHaveBeenCalledTimes(2))
      expect(sessions[0].session.shutdown).toHaveBeenCalled()
    })

    it('keeps a session that waits for the wallet on its relay on restart', async () => {
      const { transport, startSession, sessions } = createTestSuite()
      transport.setConnectionPassword(password)
      transport.connect()
      await vi.waitFor(() => expect(sessions).toHaveLength(1))

      // Back on its relay after a wake, knocking for the wallet.
      transport.restart()
      await sleep(20)

      expect(sessions[0].session.shutdown).not.toHaveBeenCalled()
      expect(startSession).toHaveBeenCalledTimes(1)
    })

    it('does not connect with an invalid relay URL', async () => {
      const { transport, connectedSession, startSession, logger } =
        createTestSuite()
      const fake = await connectedSession()

      transport.setConnectionConfig({ relayUrl: 'http://relay.example.com' })

      await vi.waitFor(() => expect(fake.session.shutdown).toHaveBeenCalled())
      await sleep(20)
      expect(startSession).toHaveBeenCalledTimes(1)
      expect(logger.error).toHaveBeenCalled()

      transport.setConnectionConfig({ relayUrl: 'https://relay.example.com' })
      await vi.waitFor(() => expect(startSession).toHaveBeenCalledTimes(2))
    })

    it('retries with a backoff when the session cannot start', async () => {
      const fake = FakeSession()
      const startSession = vi
        .fn<IrohBindings['startSession']>()
        .mockRejectedValueOnce(irohError('bind'))
        .mockRejectedValueOnce(irohError('internal'))
        .mockResolvedValueOnce(fake.session)
      const { transport, logger } = createTestSuite({ startSession })

      transport.setConnectionPassword(password)
      transport.connect()

      await vi.waitFor(() => expect(startSession).toHaveBeenCalledTimes(3))
      expect(logger.warn).toHaveBeenCalledTimes(2)
    })

    it('retries when the wasm module cannot be loaded', async () => {
      const fake = FakeSession()
      const bindings: IrohBindings = {
        startSession: vi.fn(async () => fake.session),
        publicRelayUrls: () => ['https://public-relay.example.com/'],
        validateRelayUrl: () => undefined,
      }
      const loadIroh = vi
        .fn()
        .mockReturnValueOnce(errAsync(new Error('fetch failed')))
        .mockReturnValue(okAsync(bindings))
      const { transport } = createTestSuite({ loadIroh })

      transport.setConnectionPassword(password)
      transport.connect()

      await vi.waitFor(() => expect(bindings.startSession).toHaveBeenCalled())
      expect(loadIroh).toHaveBeenCalledTimes(2)
    })

    it('does not retry errors that a new attempt cannot fix', async () => {
      const startSession = vi
        .fn<IrohBindings['startSession']>()
        .mockRejectedValue(irohError('invalidRelayUrl'))
      const { transport, logger } = createTestSuite({ startSession })

      transport.setConnectionPassword(password)
      transport.connect()

      await vi.waitFor(() => expect(logger.error).toHaveBeenCalled())
      await sleep(50)
      expect(startSession).toHaveBeenCalledTimes(1)
    })

    it('starts a new session when the current one ends by itself', async () => {
      const { connectedSession, startSession, connected } = createTestSuite()
      const fake = await connectedSession()

      fake.end()

      await vi.waitFor(() => expect(startSession).toHaveBeenCalledTimes(2))
      expect(connected.at(-1)).toBe(false)
      expect(fake.session.free).toHaveBeenCalled()
    })

    it('shuts down and frees a session that finishes starting after destroy', async () => {
      const fake = FakeSession()
      const started = deferred<typeof fake.session>()
      const startSession = vi.fn(() => started.promise)
      const { transport, connected } = createTestSuite({ startSession })

      transport.setConnectionPassword(password)
      transport.connect()
      await vi.waitFor(() => expect(startSession).toHaveBeenCalledTimes(1))

      transport.destroy()
      started.resolve(fake.session)

      await vi.waitFor(() => expect(fake.session.free).toHaveBeenCalled())
      expect(fake.session.shutdown).toHaveBeenCalled()
      expect(fake.session.nextEvent).not.toHaveBeenCalled()
      expect(connected).toEqual([false])
      await sleep(20)
      expect(startSession).toHaveBeenCalledTimes(1)
    })

    it('stops retrying once destroyed', async () => {
      const startSession = vi
        .fn<IrohBindings['startSession']>()
        .mockRejectedValue(irohError('bind'))
      const { transport } = createTestSuite({ startSession })

      transport.setConnectionPassword(password)
      transport.connect()
      await vi.waitFor(() =>
        expect(startSession.mock.calls.length).toBeGreaterThan(1),
      )

      transport.destroy()
      const attempts = startSession.mock.calls.length
      await sleep(50)

      expect(startSession).toHaveBeenCalledTimes(attempts)
    })

    it('destroy shuts the session down and frees it', async () => {
      const { transport, connectedSession, connected } = createTestSuite()
      const fake = await connectedSession()

      transport.destroy()

      await vi.waitFor(() => expect(fake.session.free).toHaveBeenCalled())
      expect(fake.session.shutdown).toHaveBeenCalledTimes(1)
      expect(connected.at(-1)).toBe(false)
    })

    it('frees the session after shutdown even with a send pending', async () => {
      const { transport, connectedSession } = createTestSuite()
      const fake = await connectedSession()
      const sending = deferred<undefined>()
      fake.session.send.mockImplementation(() => sending.promise)

      const result = transport.sendMessage({ discriminator: 'test' })
      transport.destroy()

      await vi.waitFor(() => expect(fake.session.free).toHaveBeenCalled())
      sending.reject(irohError('closed'))
      expect((await result)._unsafeUnwrapErr().reason).toBe('notConnected')
    })

    it('stops waiting for events when the shutdown does not finish in time', async () => {
      const { transport, connectedSession, startSession } = createTestSuite()
      const fake = await connectedSession()
      // A session that never closes and never reports the end of its events.
      fake.session.shutdown.mockImplementation(() => new Promise(() => {}))
      fake.session.nextEvent.mockImplementation(() => new Promise(() => {}))

      transport.setConnectionPassword(otherPassword)

      // shutdownTimeoutMs is 200 in this suite.
      await vi.waitFor(() => expect(startSession).toHaveBeenCalledTimes(2))
      expect(fake.session.free).toHaveBeenCalled()
    })

    it('shutdown resolves once the endpoint is closed', async () => {
      const { transport, connectedSession } = createTestSuite()
      const fake = await connectedSession()
      const shutdown = deferred<undefined>()
      fake.session.shutdown.mockImplementation(() => shutdown.promise)

      let done = false
      transport.shutdown().map(() => {
        done = true
      })
      await sleep(20)
      expect(done).toBe(false)

      shutdown.resolve(undefined)
      fake.end()

      await vi.waitFor(() => expect(done).toBe(true))
    })
  })

  describe('events', () => {
    it('reports the connection state of the session', async () => {
      const { connectedSession, connected } = createTestSuite()
      const fake = await connectedSession()

      fake.setState('disconnected')
      await vi.waitFor(() => expect(connected.at(-1)).toBe(false))
      fake.setState('connected')
      await vi.waitFor(() => expect(connected.at(-1)).toBe(true))

      expect(connected).toEqual([false, true, false, true])
    })

    it('emits JSON object messages and drops anything else without logging it', async () => {
      const { connectedSession, messages, logger } = createTestSuite()
      const fake = await connectedSession()

      fake.receive('"secret string"')
      fake.receive('[1, 2]')
      fake.receive('null')
      fake.receive('{not json secret')
      fake.receive(JSON.stringify({ discriminator: 'linkClient', id: 1 }))

      await vi.waitFor(() => expect(messages).toHaveLength(1))
      expect(messages[0]).toEqual({ discriminator: 'linkClient', id: 1 })
      expect(logger.warn).toHaveBeenCalledTimes(4)
      const logged = JSON.stringify(logger.warn.mock.calls)
      expect(logged).not.toContain('secret')
    })
  })

  describe('wallet notices', () => {
    it("passes on a request delivered again, and the wallet's presence", async () => {
      const { connectedSession, transport } = createTestSuite()
      const notices: WalletNotice[] = []
      transport.walletNotices$!.subscribe((notice) => notices.push(notice))
      const fake = await connectedSession()

      fake.notify({ type: 'requestRedelivered', interactionId: 'req-1' })
      fake.notify({ type: 'peerPresence', inBackground: true })

      await vi.waitFor(() => expect(notices).toHaveLength(2))
      expect(notices).toEqual([
        { type: 'requestRedelivered', interactionId: 'req-1' },
        { type: 'presence', inBackground: true },
      ])
    })

    it('says whether the wallet reports the requests it holds', async () => {
      const { connectedSession, transport } = createTestSuite()
      const fake = await connectedSession()
      expect(transport.reportsRequests!()).toBe(false)

      fake.reportsRequests(true)

      expect(transport.reportsRequests!()).toBe(true)
    })

    it('tells the library a cancelled request is not to be sent again', async () => {
      const { connectedSession, transport } = createTestSuite()
      const fake = await connectedSession()
      const forgetRequest = vi.fn()
      ;(fake.session as IrohSession).forgetRequest = forgetRequest

      transport.forgetRequest!('req-1')

      expect(forgetRequest).toHaveBeenCalledWith('req-1')
    })

    it('forgets nothing with a library that predates it', async () => {
      const { connectedSession, transport } = createTestSuite()
      await connectedSession()

      expect(() => transport.forgetRequest!('req-1')).not.toThrow()
    })
  })

  describe('sendMessage', () => {
    it('returns notConnected without sending while there is no connection', async () => {
      const { transport, sessions } = createTestSuite()

      const beforeStart = await transport.sendMessage({ a: 1 })
      transport.setConnectionPassword(password)
      transport.connect()
      await vi.waitFor(() => expect(sessions).toHaveLength(1))
      const whileDisconnected = await transport.sendMessage({ a: 1 })

      expect(beforeStart._unsafeUnwrapErr().reason).toBe('notConnected')
      expect(whileDisconnected._unsafeUnwrapErr().reason).toBe('notConnected')
      expect(sessions[0].session.send).not.toHaveBeenCalled()
    })

    it('sends the message as one JSON string and resolves once confirmed', async () => {
      const { transport, connectedSession } = createTestSuite()
      const fake = await connectedSession()

      const result = await transport.sendMessage({
        discriminator: 'test',
        n: 1,
      })

      expect(result.isOk()).toBe(true)
      expect(fake.session.send).toHaveBeenCalledWith(
        JSON.stringify({ discriminator: 'test', n: 1 }),
      )
    })

    it('fails with failedToPrepareMessage when the message cannot be serialized', async () => {
      const { transport, connectedSession } = createTestSuite()
      const fake = await connectedSession()
      const message: Record<string, any> = {}
      message.self = message

      const result = await transport.sendMessage(message)

      expect(result._unsafeUnwrapErr().reason).toBe('failedToPrepareMessage')
      expect(fake.session.send).not.toHaveBeenCalled()
    })

    it.each([
      ['notConnected', 'notConnected'],
      ['closed', 'notConnected'],
      ['timeout', 'timeout'],
      ['messageTooLarge', 'failedToPrepareMessage'],
      ['rejected', 'failedToSendMessage'],
      ['connectionLost', 'failedToSendMessage'],
      ['internal', 'failedToSendMessage'],
    ] as const)('maps the %s error to %s', async (code, reason) => {
      const { transport, connectedSession } = createTestSuite()
      const fake = await connectedSession()
      fake.session.send.mockRejectedValue(irohError(code))

      const result = await transport.sendMessage({ a: 1 })

      expect(result._unsafeUnwrapErr().reason).toBe(reason)
    })

    it('maps unknown errors to failedToSendMessage', async () => {
      const { transport, connectedSession } = createTestSuite()
      const fake = await connectedSession()
      fake.session.send.mockRejectedValue(new Error('boom'))

      const result = await transport.sendMessage({ a: 1 })

      expect(result._unsafeUnwrapErr().reason).toBe('failedToSendMessage')
    })

    it('leaves the timeout to the session, not to the caller', async () => {
      const { transport, connectedSession } = createTestSuite()
      const fake = await connectedSession()
      fake.session.send.mockImplementation(() => sleep(50))

      const result = await transport.sendMessage({ a: 1 }, { timeout: 10 })

      expect(result.isOk()).toBe(true)
    })

    it('reports a timeout if the library never settles a send', async () => {
      const { transport, connectedSession } = createTestSuite({
        ackTimeoutMs: 30,
      })
      const fake = await connectedSession()
      fake.session.send.mockImplementation(() => new Promise(() => {}))

      const startedAt = Date.now()
      const result = await transport.sendMessage({ a: 1 })

      expect(result._unsafeUnwrapErr().reason).toBe('timeout')
      // Not before the session's own ack timeout plus the safety margin.
      expect(Date.now() - startedAt).toBeGreaterThanOrEqual(45)
    })
  })

  describe('logs and diagnostics', () => {
    it('logs the session summary when the wallet connects and disconnects', async () => {
      const { connectedSession, logger, connected } = createTestSuite()
      const fake = await connectedSession()

      fake.setLastError('connection ended: the peer closed it')
      fake.setState('disconnected')
      await vi.waitFor(() => expect(connected.at(-1)).toBe(false))

      expect(logger.info).toHaveBeenCalledWith('iroh: the wallet connected', {
        path: 'direct',
        rttMs: 42,
        relay: 'https://relay.example.com/',
        relayConnected: true,
        summary: expect.stringContaining('state=connected'),
      })
      expect(logger.info).toHaveBeenCalledWith(
        'iroh: the wallet disconnected',
        {
          reason: 'connection ended: the peer closed it',
          connectedForMs: expect.any(Number),
          state: 'disconnected',
          summary: expect.stringContaining(
            'last_error="connection ended: the peer closed it"',
          ),
        },
      )
    })

    it('logs how long a session ran and why it closed', async () => {
      const { transport, connectedSession, logger } = createTestSuite()
      await connectedSession()

      transport.disconnect()

      await vi.waitFor(() =>
        expect(logger.info).toHaveBeenCalledWith('iroh: session closed', {
          reason: 'disconnect',
          sessionMs: expect.any(Number),
        }),
      )
    })

    it('reports the limits with a send that timed out', async () => {
      const { transport, connectedSession, logger } = createTestSuite({
        ackTimeoutMs: 30,
      })
      const fake = await connectedSession()
      fake.session.send.mockRejectedValue(irohError('timeout'))

      await transport.sendMessage({ discriminator: 'test' })

      expect(logger.warn).toHaveBeenCalledWith(
        'iroh: sending a message failed',
        expect.objectContaining({
          reason: 'timeout',
          ackTimeoutMs: 30,
          safetyMarginMs: 20,
        }),
      )
    })

    it('warns when two sessions of this page hold the same link key', async () => {
      const runningEndpoints = new Map<string, number>()
      const logger = {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
        trace: vi.fn(),
      }
      const create = () =>
        IrohTransport({
          logger: logger as unknown as AppLogger,
          loadIroh: () =>
            okAsync({
              startSession: async () => FakeSession().session,
              publicRelayUrls: () => [],
              validateRelayUrl: () => undefined,
            }),
          runningEndpoints,
        })
      const first = create()
      const second = create()

      first.setConnectionPassword(password)
      first.connect()
      await vi.waitFor(() => expect(runningEndpoints.size).toBe(1))
      expect(logger.warn).not.toHaveBeenCalled()
      second.setConnectionPassword(password)
      second.connect()

      await vi.waitFor(() =>
        expect(logger.warn).toHaveBeenCalledWith(
          "iroh: this link's endpoint is already running in this page: the two sessions hold the same key and displace each other",
          { sessions: 2, summary: expect.stringContaining('c0ffeec0ff') },
        ),
      )
      expect(JSON.stringify(logger.warn.mock.calls)).not.toContain(
        'c0ffee'.repeat(10),
      )
      second.destroy()
      first.destroy()
      await vi.waitFor(() => expect(runningEndpoints.size).toBe(0))
    })

    it('logs send failures with reason, size and summary, but not the message', async () => {
      const { transport, connectedSession, logger } = createTestSuite()
      const fake = await connectedSession()
      fake.session.send.mockRejectedValue(irohError('connectionLost'))
      const message = { discriminator: 'test', secret: 'message-body' }

      await transport.sendMessage(message)
      await transport.sendMessage(message)

      expect(logger.warn).toHaveBeenCalledTimes(1)
      expect(logger.warn).toHaveBeenCalledWith(
        'iroh: sending a message failed',
        {
          reason: 'failedToSendMessage',
          code: 'connectionLost',
          bytes: JSON.stringify(message).length,
          summary: expect.stringContaining('state=connected'),
        },
      )
      expect(JSON.stringify(logger.warn.mock.calls)).not.toContain(
        'message-body',
      )
      expect(transport.diagnostics().lastError?.message).toBe(
        'sending a message failed: failedToSendMessage (connectionLost)',
      )
    })

    it('logs the summary and the reason when closing the session', async () => {
      const { transport, connectedSession, logger } = createTestSuite()
      await connectedSession()

      transport.setConnectionPassword(otherPassword)

      expect(logger.info).toHaveBeenCalledWith(
        'iroh: closing the session (new connection password)',
        { summary: expect.stringContaining('state=connected') },
      )
    })

    it('logs repeated start failures once per interval', async () => {
      const startSession = vi
        .fn<IrohBindings['startSession']>()
        .mockRejectedValue(irohError('bind'))
      const { transport, logger } = createTestSuite({ startSession })

      transport.setConnectionPassword(password)
      transport.connect()
      await vi.waitFor(() =>
        expect(startSession.mock.calls.length).toBeGreaterThan(2),
      )
      transport.destroy()

      expect(logger.warn).toHaveBeenCalledTimes(1)
      expect(transport.diagnostics()).toMatchObject({
        startFailures: expect.any(Number),
        lastError: {
          message: expect.stringMatching(/^could not start the session/),
        },
      })
      expect(transport.diagnostics().startFailures).toBeGreaterThan(2)
    })

    it('reports the session snapshot without the full endpoint ids', async () => {
      const { transport, connectedSession } = createTestSuite()
      await connectedSession()
      transport.setConnectionConfig({ relayUrl: '' })

      const diagnostics = transport.diagnostics()

      expect(diagnostics).toMatchObject({
        connected: true,
        relayUrlValid: true,
        startFailures: 0,
        session: {
          role: 'connector',
          state: 'connected',
          relayConnected: true,
          path: 'direct',
          rttMs: 42,
          failedAttempts: 0,
        },
      })
      const text = JSON.stringify(diagnostics)
      expect(text).not.toContain('c0ffee'.repeat(10))
      expect(text).not.toContain('beef00'.repeat(10))
      expect(text).not.toContain(password.toString('hex'))
    })

    it('checks the connection when the network changed, and logs why and the outcome', async () => {
      const { transport, connectedSession, logger, connected } =
        createTestSuite()
      const fake = await connectedSession()
      fake.session.networkChanged.mockImplementation(async () => {
        // The connection was dead: the session drops it at once.
        fake.setState('disconnected')
      })

      transport.networkChanged('wake after 60s')

      expect(fake.session.networkChanged).toHaveBeenCalledTimes(1)
      expect(logger.info).toHaveBeenCalledWith(
        'iroh: network change, checking the connection',
        { reason: 'wake after 60s', connected: true },
      )
      await vi.waitFor(() =>
        expect(logger.info).toHaveBeenCalledWith(
          'iroh: connection checked after a network change',
          {
            reason: 'wake after 60s',
            durationMs: expect.any(Number),
            connected: false,
            outcome: 'dead connection dropped',
          },
        ),
      )
      await vi.waitFor(() => expect(connected.at(-1)).toBe(false))
    })

    describe('after a wake from sleep', () => {
      // The check found the connection dead and the relay connection gone with the sleep.
      const woke = async (
        reason: string,
        { relay, survives }: { relay: boolean; survives: boolean },
      ) => {
        // The network is up when the session is renewed.
        const suite = createTestSuite({ networkAnswers: async () => true })
        const fake = await suite.connectedSession()
        fake.setRelayConnected(relay)
        fake.session.networkChanged.mockImplementation(async () => {
          if (!survives) fake.setState('disconnected')
        })
        suite.transport.networkChanged(reason)
        await vi.waitFor(() =>
          expect(suite.logger.info).toHaveBeenCalledWith(
            'iroh: connection checked after a network change',
            expect.anything(),
          ),
        )
        await sleep(20)
        return { ...suite, fake }
      }

      it('renews a session left without its wallet and its relay', async () => {
        const { startSession, fake } = await woke('wake after 244s', {
          relay: false,
          survives: false,
        })
        await vi.waitFor(() => expect(startSession).toHaveBeenCalledTimes(2))
        expect(fake.session.shutdown).toHaveBeenCalled()
      })

      it('keeps a session whose relay is back', async () => {
        const { startSession, fake } = await woke('wake after 244s', {
          relay: true,
          survives: false,
        })
        expect(startSession).toHaveBeenCalledTimes(1)
        expect(fake.session.shutdown).not.toHaveBeenCalled()
      })

      it('keeps a connection that survived the sleep, even without the relay', async () => {
        const { startSession, fake } = await woke('wake after 20s', {
          relay: false,
          survives: true,
        })
        expect(startSession).toHaveBeenCalledTimes(1)
        expect(fake.session.shutdown).not.toHaveBeenCalled()
      })

      it('renews a session whose dead connection drops seconds after the wake', async () => {
        // As measured: the check returns at once, still connected; the connection drops when
        // the check's deadline passes.
        const { startSession, fake } = await woke('wake after 241s', {
          relay: false,
          survives: true,
        })
        expect(startSession).toHaveBeenCalledTimes(1)

        fake.setState('disconnected')

        await vi.waitFor(() => expect(startSession).toHaveBeenCalledTimes(2))
      })

      it('renews nothing for a drop long after the wake', async () => {
        let clock = 1_000_000
        const { transport, connectedSession, startSession, logger } =
          createTestSuite({ now: () => clock })
        const fake = await connectedSession()
        fake.setRelayConnected(false)
        transport.networkChanged('wake after 241s')
        await vi.waitFor(() =>
          expect(logger.info).toHaveBeenCalledWith(
            'iroh: connection checked after a network change',
            expect.anything(),
          ),
        )

        clock += 60_000
        fake.setState('disconnected')
        await sleep(20)

        expect(startSession).toHaveBeenCalledTimes(1)
      })

      it("renews once the network answers at the wallet's relay, not before", async () => {
        const probes: string[] = []
        let up = false
        const { transport, connectedSession, startSession } = createTestSuite({
          walletRelay: 'https://wallet-relay.example.com./',
          networkAnswers: async (url) => {
            probes.push(url)
            return up
          },
        })
        const fake = await connectedSession()
        fake.setRelayConnected(false)
        fake.session.networkChanged.mockImplementation(async () => {
          fake.setState('disconnected')
        })

        transport.networkChanged('wake after 233s')
        await vi.waitFor(() => expect(probes.length).toBeGreaterThan(2))
        expect(startSession).toHaveBeenCalledTimes(1)
        up = true

        await vi.waitFor(() => expect(startSession).toHaveBeenCalledTimes(2))
        expect(new URL(probes[0]).pathname).toBe('/ping')
      })

      it('renews nothing if the relay comes back while the network is tried', async () => {
        let tries = 0
        const { transport, connectedSession, startSession } = createTestSuite({
          walletRelay: 'https://wallet-relay.example.com./',
          networkAnswers: async () => {
            tries += 1
            return false
          },
        })
        const fake = await connectedSession()
        fake.setRelayConnected(false)
        fake.session.networkChanged.mockImplementation(async () => {
          fake.setState('disconnected')
        })

        transport.networkChanged('wake after 233s')
        await vi.waitFor(() => expect(tries).toBeGreaterThan(1))
        fake.setRelayConnected(true)
        await sleep(50)

        expect(startSession).toHaveBeenCalledTimes(1)
      })

      it('renews nothing on a network change that is not a wake', async () => {
        const { startSession } = await woke('online', {
          relay: false,
          survives: false,
        })
        expect(startSession).toHaveBeenCalledTimes(1)
      })
    })

    it('logs a failed connection check with its code', async () => {
      const { transport, connectedSession, logger } = createTestSuite()
      const fake = await connectedSession()
      fake.session.networkChanged.mockRejectedValue(irohError('internal'))

      transport.networkChanged('online')

      await vi.waitFor(() =>
        expect(logger.warn).toHaveBeenCalledWith(
          'iroh: checking the connection after a network change failed',
          { reason: 'online', code: 'internal' },
        ),
      )
    })

    it('says once that an older library cannot check the connection', async () => {
      const { transport, connectedSession, logger } = createTestSuite()
      const fake = await connectedSession()
      delete (fake.session as Partial<typeof fake.session>).networkChanged

      transport.networkChanged('online')
      transport.networkChanged('online')

      const calls = logger.info.mock.calls.filter(([message]) =>
        String(message).includes('cannot check the connection'),
      )
      expect(calls).toHaveLength(1)
    })

    it('has nothing to check without a session', () => {
      const { transport, logger } = createTestSuite()

      expect(() => transport.networkChanged('online')).not.toThrow()
      expect(logger.debug).toHaveBeenCalledWith(
        'iroh: network change, no session to check',
        { reason: 'online' },
      )
    })

    it('reports an invalid relay URL', () => {
      const { transport } = createTestSuite()

      transport.setConnectionConfig({ relayUrl: 'http://relay.example.com' })

      expect(transport.diagnostics()).toMatchObject({
        relayUrlValid: false,
        lastError: { message: expect.stringMatching(/^invalid relay URL/) },
      })
    })
  })
})
