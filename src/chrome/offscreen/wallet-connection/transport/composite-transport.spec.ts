import { transportSlots } from './transport-slots'
import { describe, it, expect, vi } from 'vitest'
import { BehaviorSubject, Subject } from 'rxjs'
import { errAsync, okAsync, type ResultAsync } from 'neverthrow'
import type { RadixConnectTransport } from 'options/radix-connect-transport'
import {
  CompositeTransport,
  type TransportConnectionConfig,
} from './composite-transport'
import type {
  MessageErrorReason,
  TransportMessage,
  WalletNotice,
} from './wallet-transport'
import type { WebRtcTransport } from './webrtc-transport'
import { IrohTransport } from './iroh/iroh-transport'
import type { AppLogger } from 'utils/logger'

const password = Buffer.alloc(32, 3)

const FakeTransport = () => {
  const connected = new BehaviorSubject(false)
  const messages = new Subject<TransportMessage>()
  const notices = new Subject<WalletNotice>()
  return {
    connected,
    messages,
    notices,
    transport: {
      connected$: connected.asObservable(),
      onMessage$: messages.asObservable(),
      walletNotices$: notices.asObservable(),
      setConnectionPassword: vi.fn<WebRtcTransport['setConnectionPassword']>(
        () => okAsync(undefined),
      ),
      setConnectionConfig: vi.fn(),
      sendMessage: vi.fn<WebRtcTransport['sendMessage']>(() =>
        okAsync(undefined),
      ),
      connect: vi.fn(),
      disconnect: vi.fn(),
      restart: vi.fn(),
      forgetRequest: vi.fn(),
      destroy: vi.fn(),
      shutdown: vi.fn<IrohTransport['shutdown']>(() => okAsync(undefined)),
      networkChanged: vi.fn<IrohTransport['networkChanged']>(),
    },
  }
}

const failWith = (reason: MessageErrorReason) =>
  errAsync({ reason }) as ReturnType<WebRtcTransport['sendMessage']>

const transportConfig = (
  transport: RadixConnectTransport,
): TransportConnectionConfig => ({
  transport,
  webRtc: { signalingServerBaseUrl: 'wss://signaling.example.com' },
  iroh: { relayUrl: 'https://relay.example.com' },
})

const createTestSuite = () => {
  const webRtc = FakeTransport()
  const iroh = FakeTransport()
  const createIrohTransport = vi.fn(
    () => iroh.transport as unknown as IrohTransport,
  )
  const logger = { warn: vi.fn(), info: vi.fn(), error: vi.fn() }
  const clock = { time: 1_000_000 }
  const transport = CompositeTransport({
    slots: transportSlots({
      webRtc: webRtc.transport,
      createIrohTransport: createIrohTransport,
    }),
    logger: logger as unknown as AppLogger,
    irohHoldBackMs: 30_000,
    incomingDuplicateWindowMs: 60_000,
    now: () => clock.time,
  })
  const connected: boolean[] = []
  transport.connected$.subscribe((value) => connected.push(value))
  const received: TransportMessage[] = []
  transport.onMessage$.subscribe((message) => received.push(message))
  return {
    transport,
    webRtc,
    iroh,
    createIrohTransport,
    connected,
    received,
    logger,
    clock,
  }
}

/** Both transports selected and connected, iroh connecting last. */
const bothConnected = () => {
  const suite = createTestSuite()
  suite.transport.setConnectionPassword(password)
  suite.transport.connect()
  suite.transport.setConnectionConfig(transportConfig('webrtcAndIroh'))
  suite.webRtc.connected.next(true)
  suite.iroh.connected.next(true)
  return suite
}

const send = (
  transport: ReturnType<typeof createTestSuite>['transport'],
): ResultAsync<undefined, { reason: MessageErrorReason }> =>
  transport.sendMessage({ discriminator: 'test' }, { timeout: 1000 })

describe('CompositeTransport', () => {
  describe('selection', () => {
    it('connects nothing before the first configuration', () => {
      const { transport, webRtc, createIrohTransport } = createTestSuite()

      transport.connect()

      expect(webRtc.transport.connect).not.toHaveBeenCalled()
      expect(createIrohTransport).not.toHaveBeenCalled()
    })

    it('uses only WebRTC in webrtc mode, without loading iroh', () => {
      const { transport, webRtc, createIrohTransport } = createTestSuite()

      transport.setConnectionPassword(password)
      transport.connect()
      transport.setConnectionConfig(transportConfig('webrtc'))

      expect(webRtc.transport.setConnectionConfig).toHaveBeenCalledWith(
        transportConfig('webrtc').webRtc,
      )
      expect(webRtc.transport.connect).toHaveBeenCalled()
      expect(createIrohTransport).not.toHaveBeenCalled()
    })

    it('uses only iroh in iroh mode, with the link password and relay', () => {
      const { transport, webRtc, iroh } = createTestSuite()

      transport.setConnectionPassword(password)
      transport.connect()
      transport.setConnectionConfig(transportConfig('iroh'))

      expect(webRtc.transport.connect).not.toHaveBeenCalled()
      expect(webRtc.transport.disconnect).toHaveBeenCalled()
      expect(iroh.transport.setConnectionConfig).toHaveBeenCalledWith({
        relayUrl: 'https://relay.example.com',
      })
      expect(iroh.transport.setConnectionPassword).toHaveBeenCalledWith(
        password,
      )
      expect(iroh.transport.connect).toHaveBeenCalled()
    })

    it('configures iroh before connecting it', () => {
      const { transport, iroh } = createTestSuite()
      const calls: string[] = []
      iroh.transport.setConnectionConfig.mockImplementation(() =>
        calls.push('config'),
      )
      iroh.transport.setConnectionPassword.mockImplementation(() => {
        calls.push('password')
        return okAsync(undefined)
      })
      iroh.transport.connect.mockImplementation(() => calls.push('connect'))

      transport.setConnectionPassword(password)
      transport.connect()
      transport.setConnectionConfig(transportConfig('iroh'))

      expect(calls).toEqual(['config', 'password', 'connect'])
    })

    it('passes password changes to both transports', () => {
      const { transport, webRtc, iroh } = createTestSuite()
      transport.setConnectionConfig(transportConfig('webrtcAndIroh'))
      const newPassword = Buffer.alloc(32, 4)

      transport.setConnectionPassword(newPassword)

      expect(webRtc.transport.setConnectionPassword).toHaveBeenLastCalledWith(
        newPassword,
      )
      expect(iroh.transport.setConnectionPassword).toHaveBeenLastCalledWith(
        newPassword,
      )
    })

    it('disconnects iroh when it is deselected and reuses it when selected again', () => {
      const { transport, webRtc, iroh, createIrohTransport } = createTestSuite()
      transport.connect()
      transport.setConnectionConfig(transportConfig('webrtcAndIroh'))

      transport.setConnectionConfig(transportConfig('webrtc'))
      expect(iroh.transport.disconnect).toHaveBeenCalled()
      expect(iroh.transport.destroy).not.toHaveBeenCalled()

      transport.setConnectionConfig(transportConfig('iroh'))
      expect(webRtc.transport.disconnect).toHaveBeenCalled()
      expect(createIrohTransport).toHaveBeenCalledTimes(1)
      expect(iroh.transport.connect).toHaveBeenCalledTimes(2)
    })

    it('closes WebRTC at once when iroh finds the wallet app closed, and passes the notice on', () => {
      const { transport, webRtc, iroh } = bothConnected()
      const notices: WalletNotice[] = []
      transport.walletNotices$?.subscribe((notice) => notices.push(notice))

      iroh.notices.next({ type: 'walletClosed' })

      expect(webRtc.transport.restart).toHaveBeenCalledTimes(1)
      expect(iroh.transport.restart).not.toHaveBeenCalled()
      expect(notices).toEqual([{ type: 'walletClosed' }])
    })

    it('restarts no transport that is not connected when the wallet app is closed', () => {
      const { webRtc, iroh } = bothConnected()
      webRtc.connected.next(false)

      iroh.notices.next({ type: 'walletClosed' })

      expect(webRtc.transport.restart).not.toHaveBeenCalled()
    })

    it('restarts only the selected transports', () => {
      const { transport, webRtc, iroh } = createTestSuite()
      transport.setConnectionConfig(transportConfig('webrtcAndIroh'))
      transport.setConnectionConfig(transportConfig('webrtc'))

      transport.restart()

      expect(webRtc.transport.restart).toHaveBeenCalled()
      expect(iroh.transport.restart).not.toHaveBeenCalled()
    })
  })

  describe('connected$', () => {
    it('is true while any selected transport is connected', () => {
      const { transport, webRtc, iroh, connected } = createTestSuite()
      transport.setConnectionConfig(transportConfig('webrtcAndIroh'))

      iroh.connected.next(true)
      webRtc.connected.next(true)
      iroh.connected.next(false)
      webRtc.connected.next(false)

      expect(connected).toEqual([false, true, false])
    })

    it('ignores transports that are not selected', () => {
      const { transport, webRtc, iroh, connected } = createTestSuite()
      transport.setConnectionConfig(transportConfig('webrtcAndIroh'))
      iroh.connected.next(true)

      transport.setConnectionConfig(transportConfig('webrtc'))
      webRtc.connected.next(false)

      expect(connected).toEqual([false, true, false])
    })
  })

  it('merges the messages of all transports', () => {
    const { transport, webRtc, iroh } = createTestSuite()
    transport.setConnectionConfig(transportConfig('webrtcAndIroh'))
    const messages: TransportMessage[] = []
    transport.onMessage$.subscribe((message) => messages.push(message))

    webRtc.messages.next({ from: 'webrtc' })
    iroh.messages.next({ from: 'iroh' })

    expect(messages).toEqual([{ from: 'webrtc' }, { from: 'iroh' }])
  })

  describe('sendMessage', () => {
    it('uses iroh while it is connected', async () => {
      const { transport, webRtc, iroh } = createTestSuite()
      transport.setConnectionConfig(transportConfig('webrtcAndIroh'))
      webRtc.connected.next(true)
      iroh.connected.next(true)

      const result = await send(transport)

      expect(result.isOk()).toBe(true)
      expect(iroh.transport.sendMessage).toHaveBeenCalledWith(
        { discriminator: 'test' },
        { timeout: 1000 },
      )
      expect(webRtc.transport.sendMessage).not.toHaveBeenCalled()
    })

    it('uses WebRTC while iroh is not connected', async () => {
      const { transport, webRtc, iroh } = createTestSuite()
      transport.setConnectionConfig(transportConfig('webrtcAndIroh'))
      webRtc.connected.next(true)

      await send(transport)

      expect(webRtc.transport.sendMessage).toHaveBeenCalled()
      expect(iroh.transport.sendMessage).not.toHaveBeenCalled()
    })

    it('falls back to the other transport when nothing was sent', async () => {
      const { transport, webRtc, iroh } = createTestSuite()
      transport.setConnectionConfig(transportConfig('webrtcAndIroh'))
      iroh.connected.next(true)
      iroh.transport.sendMessage.mockReturnValue(failWith('notConnected'))

      const result = await send(transport)

      expect(result.isOk()).toBe(true)
      expect(iroh.transport.sendMessage).toHaveBeenCalledTimes(1)
      expect(webRtc.transport.sendMessage).toHaveBeenCalledTimes(1)
    })

    it('falls back when the first transport could not prepare the message (nothing was sent)', async () => {
      const { transport, webRtc, iroh } = bothConnected()
      iroh.transport.sendMessage.mockReturnValue(
        failWith('failedToPrepareMessage'),
      )

      const result = await send(transport)

      expect(result.isOk()).toBe(true)
      expect(webRtc.transport.sendMessage).toHaveBeenCalledTimes(1)
    })

    it.each(['timeout', 'failedToSendMessage'] as const)(
      'does not send again after %s',
      async (reason) => {
        const { transport, webRtc, iroh } = createTestSuite()
        transport.setConnectionConfig(transportConfig('webrtcAndIroh'))
        iroh.connected.next(true)
        webRtc.connected.next(true)
        iroh.transport.sendMessage.mockReturnValue(failWith(reason))

        const result = await send(transport)

        expect(result._unsafeUnwrapErr().reason).toBe(reason)
        expect(webRtc.transport.sendMessage).not.toHaveBeenCalled()
      },
    )

    it('returns notConnected when no selected transport is connected', async () => {
      const { transport, webRtc, iroh } = createTestSuite()
      transport.setConnectionConfig(transportConfig('webrtcAndIroh'))
      webRtc.transport.sendMessage.mockReturnValue(failWith('notConnected'))
      iroh.transport.sendMessage.mockReturnValue(failWith('notConnected'))

      const result = await send(transport)

      expect(result._unsafeUnwrapErr().reason).toBe('notConnected')
      expect(webRtc.transport.sendMessage).toHaveBeenCalledTimes(1)
      expect(iroh.transport.sendMessage).toHaveBeenCalledTimes(1)
    })

    it('returns notConnected before the first configuration', async () => {
      const { transport, webRtc } = createTestSuite()

      const result = await send(transport)

      expect(result._unsafeUnwrapErr().reason).toBe('notConnected')
      expect(webRtc.transport.sendMessage).not.toHaveBeenCalled()
    })

    it('never uses a transport that is not selected', async () => {
      const { transport, webRtc, iroh } = createTestSuite()
      transport.setConnectionConfig(transportConfig('webrtcAndIroh'))
      transport.setConnectionConfig(transportConfig('webrtc'))
      iroh.connected.next(true)
      webRtc.transport.sendMessage.mockReturnValue(failWith('notConnected'))

      const result = await send(transport)

      expect(result._unsafeUnwrapErr().reason).toBe('notConnected')
      expect(iroh.transport.sendMessage).not.toHaveBeenCalled()
    })
  })

  describe('forgetRequest', () => {
    it('reaches every transport that sends lost requests by itself', () => {
      const { transport, iroh } = bothConnected()

      transport.forgetRequest!('wi-1')

      expect(iroh.transport.forgetRequest).toHaveBeenCalledWith('wi-1')
    })
  })

  describe('iroh preference', () => {
    it('uses iroh when both are connected, whichever connected first', async () => {
      const { transport, webRtc, iroh } = createTestSuite()
      transport.setConnectionConfig(transportConfig('webrtcAndIroh'))
      iroh.connected.next(true)
      webRtc.connected.next(true)

      await send(transport)

      expect(iroh.transport.sendMessage).toHaveBeenCalledTimes(1)
      expect(webRtc.transport.sendMessage).not.toHaveBeenCalled()
    })

    it('switches to iroh as soon as it connects', async () => {
      const { transport, webRtc, iroh } = createTestSuite()
      transport.setConnectionConfig(transportConfig('webrtcAndIroh'))
      webRtc.connected.next(true)
      await send(transport)

      iroh.connected.next(true)
      await send(transport)

      expect(webRtc.transport.sendMessage).toHaveBeenCalledTimes(1)
      expect(iroh.transport.sendMessage).toHaveBeenCalledTimes(1)
    })

    it('logs a fallback with the transport that failed and why', async () => {
      const { transport, iroh, webRtc, logger } = bothConnected()
      iroh.transport.sendMessage.mockReturnValue(failWith('notConnected'))

      await transport.sendMessage({ interactionId: 'interaction-1' })

      expect(logger.info).toHaveBeenCalledWith(
        'sending fell back to the other transport',
        {
          from: 'iroh',
          to: 'webrtc',
          reason: 'notConnected',
          code: undefined,
          interactionId: 'interaction-1',
        },
      )
      expect(webRtc.transport.sendMessage).toHaveBeenCalledTimes(1)
    })

    it('after iroh may have failed to deliver, sends the next messages over WebRTC', async () => {
      const { transport, webRtc, iroh, logger, clock } = bothConnected()
      iroh.transport.sendMessage.mockReturnValueOnce(failWith('timeout'))

      const failed = await send(transport)
      // Not resent: the wallet may have it.
      expect(failed._unsafeUnwrapErr().reason).toBe('timeout')
      expect(webRtc.transport.sendMessage).not.toHaveBeenCalled()
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringMatching(/^iroh did not deliver a message/),
        expect.objectContaining({ reason: 'timeout', holdBackMs: 30_000 }),
      )

      // The queue's retry, and the next messages, go over WebRTC.
      clock.time += 29_999
      await send(transport)
      expect(webRtc.transport.sendMessage).toHaveBeenCalledTimes(1)
      expect(iroh.transport.sendMessage).toHaveBeenCalledTimes(1)

      // Then iroh is preferred again.
      clock.time += 1
      await send(transport)
      expect(iroh.transport.sendMessage).toHaveBeenCalledTimes(2)
    })

    it('prefers iroh again as soon as it reconnects', async () => {
      const { transport, iroh, webRtc, logger } = bothConnected()
      iroh.transport.sendMessage.mockReturnValueOnce(
        failWith('failedToSendMessage'),
      )
      await send(transport)
      await send(transport)
      expect(webRtc.transport.sendMessage).toHaveBeenCalledTimes(1)

      iroh.connected.next(false)
      iroh.connected.next(true)
      await send(transport)
      expect(iroh.transport.sendMessage).toHaveBeenCalledTimes(2)
      expect(logger.info).toHaveBeenCalledWith(
        'iroh reconnected: preferred again for sending',
      )
    })

    it('keeps iroh first after a failure when WebRTC is not connected', async () => {
      const { transport, webRtc, iroh } = createTestSuite()
      transport.setConnectionConfig(transportConfig('webrtcAndIroh'))
      iroh.connected.next(true)
      iroh.transport.sendMessage.mockReturnValueOnce(failWith('timeout'))
      webRtc.transport.sendMessage.mockReturnValue(failWith('notConnected'))

      await send(transport)
      await send(transport)

      expect(iroh.transport.sendMessage).toHaveBeenCalledTimes(2)
    })

    it('never holds iroh back in iroh mode', async () => {
      const { transport, iroh } = createTestSuite()
      transport.setConnectionConfig(transportConfig('iroh'))
      iroh.connected.next(true)
      iroh.transport.sendMessage.mockReturnValueOnce(failWith('timeout'))

      await send(transport)
    })
  })

  describe('incoming messages', () => {
    const response = { discriminator: 'success', interactionId: 'abc' }

    it('drops a message received again over the other transport, and logs it', () => {
      const { webRtc, iroh, received, logger, clock } = bothConnected()

      iroh.messages.next({ ...response })
      clock.time += 1_500
      webRtc.messages.next({ ...response })

      expect(received).toEqual([response])
      expect(logger.info).toHaveBeenCalledWith(
        'dropped a duplicate message from the wallet',
        expect.objectContaining({
          via: 'webrtc',
          firstVia: 'iroh',
          sinceFirstMs: 1_500,
          windowMs: 60_000,
          interactionId: 'abc',
        }),
      )
    })

    it('delivers different messages with the same interaction id', () => {
      const { webRtc, iroh, received } = bothConnected()

      iroh.messages.next({
        discriminator: 'signTransaction',
        interactionId: 'a',
      })
      webRtc.messages.next({ discriminator: 'success', interactionId: 'a' })

      expect(received).toHaveLength(2)
    })

    it('delivers a message the same transport carries twice', () => {
      const { webRtc, received } = bothConnected()

      webRtc.messages.next({ ...response })
      webRtc.messages.next({ ...response })

      expect(received).toHaveLength(2)
    })

    it('drops nothing, and logs nothing, with WebRTC alone', () => {
      const { transport, webRtc, received, logger } = createTestSuite()
      transport.connect()
      transport.setConnectionConfig(transportConfig('webrtc'))
      webRtc.connected.next(true)

      webRtc.messages.next({ ...response })
      webRtc.messages.next({ ...response })
      webRtc.connected.next(false)

      expect(received).toHaveLength(2)
      expect(logger.info).not.toHaveBeenCalled()
      expect(logger.warn).not.toHaveBeenCalled()
    })

    it('delivers the same message again after the window', () => {
      const { webRtc, iroh, received, clock } = bothConnected()

      iroh.messages.next({ ...response })
      clock.time += 60_000
      webRtc.messages.next({ ...response })

      expect(received).toHaveLength(2)
    })
  })

  describe('link state and events', () => {
    it('logs which transports run and why', () => {
      const { transport, logger } = createTestSuite()
      transport.connect()
      transport.setConnectionConfig(transportConfig('webrtc'))
      transport.setConnectionConfig(transportConfig('webrtcAndIroh'))

      // WebRTC alone logs nothing more than without iroh.
      expect(logger.info).toHaveBeenCalledTimes(1)
      expect(logger.info).toHaveBeenCalledWith('link transports changed', {
        mode: 'webrtcAndIroh',
        running: 'iroh, webrtc',
        started: 'iroh',
        stopped: 'none',
        reason: 'option changed: webrtc → webrtcAndIroh',
      })
    })
  })

  describe('networkChanged', () => {
    it('has iroh check its connection', () => {
      const { transport, iroh } = bothConnected()

      transport.networkChanged('online')

      expect(iroh.transport.networkChanged).toHaveBeenCalledWith('online')
    })

    it('does nothing while iroh is not selected', () => {
      const { transport, iroh } = createTestSuite()
      transport.setConnectionConfig(transportConfig('webrtcAndIroh'))
      transport.setConnectionConfig(transportConfig('webrtc'))

      transport.networkChanged('online')

      expect(iroh.transport.networkChanged).not.toHaveBeenCalled()
    })
  })

  describe('releaseIroh', () => {
    it('resolves at once without touching WebRTC when iroh is not used', async () => {
      const { transport, webRtc, createIrohTransport } = createTestSuite()
      transport.connect()
      transport.setConnectionConfig(transportConfig('webrtc'))

      const result = await transport.releaseIroh(1000)

      expect(result.isOk()).toBe(true)
      expect(createIrohTransport).not.toHaveBeenCalled()
      expect(webRtc.transport.disconnect).not.toHaveBeenCalled()
    })

    it('waits for the wallet to close its iroh connection, then shuts iroh down', async () => {
      const { transport, webRtc, iroh } = createTestSuite()
      transport.connect()
      transport.setConnectionConfig(transportConfig('webrtcAndIroh'))
      iroh.connected.next(true)
      webRtc.transport.disconnect.mockClear()

      let released = false
      transport.releaseIroh(1000).map(() => {
        released = true
      })
      await new Promise((resolve) => {
        setTimeout(resolve, 20)
      })
      expect(iroh.transport.shutdown).not.toHaveBeenCalled()

      iroh.connected.next(false)

      await vi.waitFor(() => expect(released).toBe(true))
      expect(iroh.transport.shutdown).toHaveBeenCalledTimes(1)
      expect(webRtc.transport.disconnect).not.toHaveBeenCalled()
    })

    it('shuts iroh down after the grace period if the wallet stays connected', async () => {
      const { transport, iroh } = createTestSuite()
      transport.connect()
      transport.setConnectionConfig(transportConfig('iroh'))
      iroh.connected.next(true)

      const startedAt = Date.now()
      const result = await transport.releaseIroh(30)

      expect(result.isOk()).toBe(true)
      expect(Date.now() - startedAt).toBeGreaterThanOrEqual(25)
      expect(iroh.transport.shutdown).toHaveBeenCalledTimes(1)
    })
  })

  it('destroy destroys both transports', () => {
    const { transport, webRtc, iroh } = createTestSuite()
    transport.setConnectionConfig(transportConfig('webrtcAndIroh'))

    transport.destroy()

    expect(webRtc.transport.destroy).toHaveBeenCalled()
    expect(iroh.transport.destroy).toHaveBeenCalled()
  })
})
