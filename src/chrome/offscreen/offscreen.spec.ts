import {
  extensionPageSender,
  webPageSender,
} from 'chrome/messages/senders.test-utils'
import { MessageClient } from 'chrome/messages/message-client'
import { OffscreenMessageHandler } from './message-handler'
import { Logger } from 'tslog'
import {
  OffscreenServices,
  WalletConnectionClientFactory,
} from './wallet-connection/factory'
import { LogsClient } from './logs-client'
import type { WalletConnectionClient } from './wallet-connection/wallet-connection-client'
import { MessageSubjects } from 'chrome/messages/subjects'
import type { Message } from 'chrome/messages/_types'
import { okAsync } from 'neverthrow'
import { BehaviorSubject, Subject, of } from 'rxjs'
import { describe, it, expect, vi, afterEach } from 'vitest'
import type { TransportMessage } from './wallet-connection/transport/wallet-transport'
import {
  RequestTracker,
  type RequestNotification,
} from './requests/request-tracker'
import { defaultConnectorExtensionOptions } from 'options'
import { createMessage } from 'chrome/messages/create-message'
import { formatDiagnosticsReport } from 'options/diagnostics-report'
import type {
  ConnectionDiagnosticsResponse,
  TransportDiagnostics,
} from './wallet-connection/transport/diagnostics'

// What the wallet links of these tests share, as an offscreen document's would.
const services = OffscreenServices()
const walletConnectionClientFactory = WalletConnectionClientFactory(services)

const logger = new Logger()
const logsClient = LogsClient()
const subjects = MessageSubjects()

const MockTransport = () => ({
  setConnectionPassword: vi.fn(() => okAsync(undefined)),
  setConnectionConfig: vi.fn(),
  sendMessage: vi.fn(() => okAsync(undefined)),
  connected$: of(true),
  onMessage$: of({} as any),
  connect: vi.fn(),
  restart: vi.fn(),
  destroy: vi.fn(),
  diagnostics: vi.fn(
    (): TransportDiagnostics => ({
      transport: 'webrtc',
      connected: true,
      webRtc: {
        connected: true,
        signalingServer: 'wss://signaling.example.com',
        signalingConnected: true,
      },
    }),
  ),
})

const createTestSuite = () => {
  const connections = new Map<string, WalletConnectionClient>()
  const transports = new Map<string, ReturnType<typeof MockTransport>>()
  const messageClient = MessageClient(
    OffscreenMessageHandler({
      services,
      connectionsMap: connections,
      logger,
      walletConnectionClientFactory: (input) => {
        const transport = MockTransport()
        transports.set(input.connection.walletName, transport)
        return walletConnectionClientFactory({
          ...input,
          transport: transport as any,
        })
      },
      logsClient,
    }),
    'offScreen',
    {
      logger,
      subjects,
      sendMessage: (message: Message, tabId?: number) => {
        logger.debug('sendMessage', { message, tabId })
        subjects.messageSubject.next({ message, tabId })

        return okAsync(undefined)
      },
    },
  )
  return { messageClient, connections, transports }
}

const setConnections = (messageClient: MessageClient, walletNames: string[]) =>
  messageClient.handleMessage({
    connections: Object.fromEntries(
      walletNames.map((walletName) => [
        walletName,
        {
          password: '00'.repeat(32),
          walletName,
          walletPublicKey: `${walletName}`.padEnd(64, '0'),
          accounts: [],
        },
      ]),
    ),
    discriminator: 'setConnections',
  } as any)

const setOptions = (
  messageClient: MessageClient,
  options: Partial<typeof defaultConnectorExtensionOptions>,
) =>
  messageClient.handleMessage({
    connectorExtensionOptions: {
      ...defaultConnectorExtensionOptions,
      ...options,
    },
    discriminator: 'setRadixConnectConfiguration',
  } as any)

describe('offscreen', () => {
  it('should save new connections in connections map', () => {
    const { messageClient, connections } = createTestSuite()
    messageClient.handleMessage({
      connections: {
        '1': {
          password: 'password',
          walletName: 'walletName',
        },
      },
      discriminator: 'setConnections',
    } as any)
    expect(connections.get('1')).toBeDefined()
  })
  it('should remove non-existent connections after new "setConnections" message', () => {
    const { messageClient, connections } = createTestSuite()
    messageClient.handleMessage({
      connections: {
        '1': {
          password: 'password',
          walletName: 'walletName',
        },
        '2': {
          password: 'password',
          walletName: 'walletName',
        },
      },
      discriminator: 'setConnections',
    } as any)
    expect(connections.get('1')).toBeDefined()
    expect(connections.get('2')).toBeDefined()
    messageClient.handleMessage({
      connections: {
        '1': {
          password: 'password',
          walletName: 'walletName',
        },
      },
      discriminator: 'setConnections',
    } as any)
    expect(connections.get('1')).toBeDefined()
    expect(connections.get('2')).toBeUndefined()
  })
  it('should add new connections after new "setConnections" message', () => {
    const { messageClient, connections } = createTestSuite()
    messageClient.handleMessage({
      connections: {
        '1': {
          password: 'password',
          walletName: 'walletName',
        },
      },
      discriminator: 'setConnections',
    } as any)
    messageClient.handleMessage({
      connections: {
        '1': {
          password: 'password',
          walletName: 'walletName',
        },
        '2': {
          password: 'password',
          walletName: 'walletName',
        },
      },
      discriminator: 'setConnections',
    } as any)
    expect(connections.get('1')).toBeDefined()
    expect(connections.get('2')).toBeDefined()
  })

  it('configures clients created before the options arrived', () => {
    const { messageClient, transports } = createTestSuite()
    setConnections(messageClient, ['early'])
    expect(transports.get('early')?.setConnectionConfig).not.toHaveBeenCalled()

    setOptions(messageClient, {
      radixConnectTransport: 'webrtcAndIroh',
      irohRelayUrl: 'https://relay.example.com',
    })

    expect(transports.get('early')?.setConnectionConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        transport: 'webrtcAndIroh',
        iroh: { relayUrl: 'https://relay.example.com' },
      }),
    )
  })

  it('configures clients created after the options arrived', () => {
    const { messageClient, transports } = createTestSuite()
    setOptions(messageClient, { radixConnectTransport: 'iroh' })

    setConnections(messageClient, ['late'])

    expect(transports.get('late')?.setConnectionConfig).toHaveBeenCalledWith(
      expect.objectContaining({ transport: 'iroh' }),
    )
  })

  it('reconfigures every client when the options change', () => {
    const { messageClient, transports } = createTestSuite()
    setOptions(messageClient, {})
    setConnections(messageClient, ['a', 'b'])

    setOptions(messageClient, { radixConnectTransport: 'iroh' })

    for (const name of ['a', 'b']) {
      expect(
        transports.get(name)?.setConnectionConfig,
      ).toHaveBeenLastCalledWith(expect.objectContaining({ transport: 'iroh' }))
    }
  })

  it('restarts the transport of every client', () => {
    const { messageClient, transports } = createTestSuite()
    setConnections(messageClient, ['a', 'b'])

    messageClient.handleMessage({ discriminator: 'restartConnector' } as any)

    expect(transports.get('a')?.restart).toHaveBeenCalledTimes(1)
    expect(transports.get('b')?.restart).toHaveBeenCalledTimes(1)
  })

  it('destroys the transport of a forgotten wallet', () => {
    const { messageClient, transports } = createTestSuite()
    setConnections(messageClient, ['a', 'b'])

    setConnections(messageClient, ['a'])

    expect(transports.get('b')?.destroy).toHaveBeenCalled()
    expect(transports.get('a')?.destroy).not.toHaveBeenCalled()
  })

  it('answers connection diagnostics', async () => {
    const { messageClient } = createTestSuite()
    const walletPublicKey = 'ab'.repeat(32)
    const password = 'cd'.repeat(32)
    await messageClient.handleMessage({
      connections: {
        [walletPublicKey]: {
          password,
          walletName: 'My wallet',
          walletPublicKey,
          accounts: [],
        },
      },
      discriminator: 'setConnections',
    } as any)

    const result = await messageClient.handleMessage(
      createMessage.getConnectionDiagnostics(),
    )

    const { connections } = result._unsafeUnwrap()
      .data as ConnectionDiagnosticsResponse
    expect(connections).toEqual([
      expect.objectContaining({
        walletName: 'My wallet',
        walletKey: 'abababab',
        transport: 'webrtc',
        connected: true,
        pending: { dAppRequests: 0, ledgerResponses: 0 },
      }),
    ])
    const report = formatDiagnosticsReport({
      generatedAt: new Date(0),
      extensionVersion: 'test',
      browser: 'test',
      connections,
    })
    expect(report).toContain('\nWallet abababab\n')
    for (const text of [JSON.stringify(connections), report]) {
      expect(text).not.toContain(password)
      expect(text).not.toContain(walletPublicKey)
    }
  })
})

describe('offscreen diagnostics in the logs', () => {
  it('warns when two linked wallets share one link password, naming them by short key', () => {
    const { messageClient } = createTestSuite()
    const warn = vi.spyOn(logger, 'warn')
    const password = 'ef'.repeat(32)

    messageClient.handleMessage({
      connections: {
        ['aa'.repeat(32)]: {
          password,
          walletName: 'A',
          walletPublicKey: 'aa'.repeat(32),
        },
        ['bb'.repeat(32)]: {
          password,
          walletName: 'B',
          walletPublicKey: 'bb'.repeat(32),
        },
      },
      discriminator: 'setConnections',
    } as any)

    expect(warn).toHaveBeenCalledWith(
      'several linked wallets share one link password: their connections displace each other',
      { wallets: 'aaaaaaaa, bbbbbbbb' },
    )
    expect(JSON.stringify(warn.mock.calls)).not.toContain(password)
    warn.mockRestore()
  })
})

describe('dApp requests', () => {
  afterEach(() => {
    vi.mocked(chrome.runtime.sendMessage).mockReset()
    ;(chrome.runtime as any).id = undefined
  })

  const setup = () => {
    // Only this test's wallet link listens to the dApp requests below.
    // @ts-expect-error vitest-chrome events can be reset from tests
    chrome.runtime.onMessage.clearListeners()
    const sent: Message[] = []
    ;(chrome.runtime as any).id = 'test-extension'
    // The background: passes messages for a dApp tab on, and confirms them.
    vi.mocked(chrome.runtime.sendMessage).mockImplementation(((
      message: Message,
    ) => {
      sent.push(message)
      if (message.discriminator === 'sendMessageToTab')
        setTimeout(() =>
          // @ts-expect-error vitest-chrome events can be triggered from tests
          chrome.runtime.onMessage.callListeners(
            createMessage.confirmationSuccess(
              'background',
              message.messageId,
              undefined,
            ),
            extensionPageSender(),
          ),
        )
      return Promise.resolve()
    }) as any)
    const notifications: RequestNotification[] = []
    const tracker = RequestTracker({
      notifyDelayMs: 0,
      walletLostAfterMs: 20,
      onNotification: (notification) => notifications.push(notification),
    })
    const connected = new BehaviorSubject(false)
    const fromWallet = new Subject<TransportMessage>()
    const transport = {
      ...MockTransport(),
      connected$: connected.asObservable(),
      onMessage$: fromWallet.asObservable(),
      sendMessage: vi.fn(() => okAsync(undefined)),
    }
    const messageClient = MessageClient(
      OffscreenMessageHandler({
        connectionsMap: new Map(),
        logger,
        logsClient,
        services: { ...services, requestTracker: tracker },
        walletConnectionClientFactory: (input) =>
          walletConnectionClientFactory({
            ...input,
            transport: transport as any,
            requestTracker: tracker,
          }),
      }),
      'offScreen',
      { logger, sendMessage: () => okAsync(undefined) },
    )
    messageClient.handleMessage({
      connections: {
        ['3e'.repeat(32)]: {
          password: '5a'.repeat(32),
          walletName: 'Wallet',
          walletPublicKey: '3e'.repeat(32),
          accounts: [],
        },
      },
      discriminator: 'setConnections',
    } as any)
    const request = (interactionId: string) =>
      // @ts-expect-error vitest-chrome events can be triggered from tests
      chrome.runtime.onMessage.callListeners(
        createMessage.dAppRequest('contentScript', {
          interactionId,
          metadata: {
            version: 2,
            origin: 'https://dapp.example.com/swap?x=1',
            networkId: 1,
            dAppDefinitionAddress: 'account_tdx_dapp',
          },
          items: {
            discriminator: 'transaction',
            send: { transactionManifest: 'example-manifest', version: 1 },
          },
        } as any),
        { tab: { id: 5 } },
        () => {},
      )
    /** The wallet accepts the request. */
    const answer = (interactionId: string) =>
      fromWallet.next({ discriminator: 'success', interactionId, items: {} })
    return {
      messageClient,
      tracker,
      transport,
      connected,
      notifications,
      sent,
      request,
      answer,
    }
  }

  it('follows a request from the queue to the wallet, then to its answer', async () => {
    const { tracker, connected, transport, notifications, request, answer } =
      setup()

    request('req-1')
    await vi.waitFor(() =>
      expect(tracker.get('req-1')).toMatchObject({
        origin: 'dapp.example.com',
        kind: 'transaction',
        status: 'waitingForWallet',
      }),
    )
    await vi.waitFor(() =>
      expect(notifications[0]).toMatchObject({
        action: 'create',
        walletConnected: false,
      }),
    )

    connected.next(true)
    await vi.waitFor(() =>
      expect(tracker.get('req-1')?.status).toBe('deliveredToWallet'),
    )
    expect(transport.sendMessage).toHaveBeenCalled()
    expect(JSON.stringify(tracker.list())).not.toContain('example-manifest')
    expect(notifications.map((notification) => notification.action)).toEqual([
      'create',
      'update',
    ])

    answer('req-1')
    // Answered: its card goes away.
    await vi.waitFor(() => expect(tracker.get('req-1')).toBeUndefined())
    expect(tracker.list()).toEqual([])
  })

  it('sends a dApp one request at a time: the next once the wallet answered', async () => {
    const { tracker, connected, transport, request, answer } = setup()
    connected.next(true)
    const sentIds = () =>
      transport.sendMessage.mock.calls.map(
        (call) =>
          (call as unknown as [{ interactionId: string }])[0].interactionId,
      )

    request('turn-1')
    await vi.waitFor(() =>
      expect(tracker.get('turn-1')?.status).toBe('deliveredToWallet'),
    )
    request('turn-2')
    await vi.waitFor(() =>
      expect(tracker.get('turn-2')?.status).toBe('waitingForTurn'),
    )
    await new Promise((resolve) => {
      setTimeout(resolve, 50)
    })
    expect(sentIds()).toEqual(['turn-1'])

    answer('turn-1')

    await vi.waitFor(() =>
      expect(tracker.get('turn-2')?.status).toBe('deliveredToWallet'),
    )
    expect(sentIds()).toEqual(['turn-1', 'turn-2'])
  })

  it('cancels a request waiting for its turn, which never reaches the wallet', async () => {
    const { messageClient, tracker, connected, transport, request } = setup()
    connected.next(true)
    request('turn-3')
    await vi.waitFor(() =>
      expect(tracker.get('turn-3')?.status).toBe('deliveredToWallet'),
    )
    request('turn-4')
    await vi.waitFor(() =>
      expect(tracker.get('turn-4')?.status).toBe('waitingForTurn'),
    )

    const result = await messageClient.handleMessage(
      createMessage.cancelPendingRequest('turn-4'),
    )

    expect(result._unsafeUnwrap().data).toEqual({ cancelled: true })
    expect(tracker.get('turn-4')).toBeUndefined()
    expect(transport.sendMessage).toHaveBeenCalledTimes(1)
  })

  it('cancels from the popup a request not sent yet, and rejects it to the dApp', async () => {
    const { messageClient, tracker, sent, request } = setup()
    request('req-2')
    await vi.waitFor(() => expect(tracker.get('req-2')).toBeDefined())

    const result = await messageClient.handleMessage(
      createMessage.cancelPendingRequest('req-2'),
    )

    expect(result._unsafeUnwrap().data).toEqual({ cancelled: true })
    // Cancelled: its card goes away.
    expect(tracker.get('req-2')).toBeUndefined()
    const toTab = sent.find(
      (message) => message.discriminator === 'sendMessageToTab',
    ) as any
    expect(toTab.tabId).toBe(5)
    expect(toTab.data.data.walletResponse).toEqual({
      discriminator: 'failure',
      interactionId: 'req-2',
      error: 'rejectedByUser',
      message: 'Cancelled in the Radix Wallet Connector',
    })
  })

  it('does not cancel a request the wallet already received', async () => {
    const { messageClient, tracker, connected, request } = setup()
    connected.next(true)
    request('req-3')
    await vi.waitFor(() =>
      expect(tracker.get('req-3')?.status).toBe('deliveredToWallet'),
    )

    const result = await messageClient.handleMessage(
      createMessage.cancelPendingRequest('req-3'),
    )

    expect(result._unsafeUnwrap().data).toEqual({
      cancelled: false,
      status: 'deliveredToWallet',
    })
    expect(tracker.get('req-3')?.status).toBe('deliveredToWallet')
  })

  /** A request its wallet received, then lost: the link stayed down. */
  const lostInTheWallet = async (interactionId: string) => {
    const context = setup()
    context.connected.next(true)
    context.request(interactionId)
    await vi.waitFor(() =>
      expect(context.tracker.get(interactionId)?.status).toBe(
        'deliveredToWallet',
      ),
    )
    context.connected.next(false)
    await vi.waitFor(() =>
      expect(context.tracker.get(interactionId)?.status).toBe(
        'walletDisconnected',
      ),
    )
    return context
  }

  it('sends again to its wallet a request the wallet disconnected without answering', async () => {
    const { messageClient, tracker, connected, transport } =
      await lostInTheWallet('req-4')
    connected.next(true)

    const result = await messageClient.handleMessage(
      createMessage.resendPendingRequest('req-4'),
    )

    expect(result._unsafeUnwrap().data).toEqual({ resent: true })
    await vi.waitFor(() =>
      expect(tracker.get('req-4')?.status).toBe('deliveredToWallet'),
    )
    const sentTo = (
      vi.mocked(transport.sendMessage).mock.calls as unknown as [
        { interactionId?: string },
      ][]
    ).filter(([message]) => message.interactionId === 'req-4')
    expect(sentTo).toHaveLength(2)
  })

  it('cancels a request whose wallet disconnected without answering, and rejects it to the dApp', async () => {
    const { messageClient, tracker, sent } = await lostInTheWallet('req-5')

    const result = await messageClient.handleMessage(
      createMessage.cancelPendingRequest('req-5'),
    )

    expect(result._unsafeUnwrap().data).toEqual({ cancelled: true })
    expect(tracker.get('req-5')).toBeUndefined()
    const toTab = sent.find(
      (message: any) =>
        message.discriminator === 'sendMessageToTab' &&
        message.data?.data?.walletResponse,
    ) as any
    expect(toTab.data.data.walletResponse).toMatchObject({
      interactionId: 'req-5',
      error: 'rejectedByUser',
    })
  })

  it('passes a ledger response to the link of the wallet that asked for it', async () => {
    const { messageClient, connected, transport } = setup()
    connected.next(true)
    const response = {
      interactionId: 'ledger-1',
      discriminator: 'getDeviceInfo',
      success: { id: 'device', model: 'nanoS' },
    } as any

    await messageClient.handleMessage(
      createMessage.ledgerResponse(response, 'ff'.repeat(32)),
    )
    await messageClient.handleMessage(
      createMessage.ledgerResponse(response, '3e'.repeat(32)),
    )

    await vi.waitFor(() =>
      expect(transport.sendMessage).toHaveBeenCalledWith(
        response,
        expect.anything(),
      ),
    )
    expect(transport.sendMessage).toHaveBeenCalledTimes(1)
  })

  it('does not send again a request still in its wallet', async () => {
    const { messageClient, tracker, connected, request } = setup()
    connected.next(true)
    request('req-6')
    await vi.waitFor(() =>
      expect(tracker.get('req-6')?.status).toBe('deliveredToWallet'),
    )

    const result = await messageClient.handleMessage(
      createMessage.resendPendingRequest('req-6'),
    )

    expect(result._unsafeUnwrap().data).toEqual({ resent: false })
  })

  const metadata = {
    version: 2,
    origin: 'https://dapp.example.com',
    networkId: 1,
    dAppDefinitionAddress: 'account_tdx_dapp',
  }
  const fromTab = (message: Message) =>
    // @ts-expect-error vitest-chrome events can be triggered from tests
    chrome.runtime.onMessage.callListeners(message, webPageSender(5), () => {})
  const walletInteraction = (
    interactionId: string,
    items: Record<string, unknown>,
    sessionId?: string,
  ) =>
    fromTab(
      createMessage.walletInteraction({
        interactionId,
        sessionId,
        interaction: { interactionId, metadata, items },
      } as any),
    )
  const cancelSuccessSentFor = (sent: Message[], interactionId: string) =>
    sent.some(
      (message: any) =>
        // Through the background, to the dApp's tab.
        message.discriminator === 'sendMessageToTab' &&
        message.data?.discriminator === 'sendMessageEventToDapp' &&
        message.data.messageEvent === 'requestCancelSuccess' &&
        message.data.data?.interactionId === interactionId,
    )

  it('queues a dApp toolkit request without a session for the wallet', async () => {
    const { tracker } = setup()

    walletInteraction('wi-1', { discriminator: 'unauthorizedRequest' })

    await vi.waitFor(() =>
      expect(tracker.get('wi-1')).toMatchObject({
        origin: 'dapp.example.com',
        kind: 'data',
        status: 'waitingForWallet',
      }),
    )
  })

  it('leaves a request whose session belongs to another wallet to that wallet', async () => {
    const { tracker } = setup()
    services.sessionRouter.refreshStore({ 'session-1': 'ff'.repeat(32) })
    services.sessionRouter.setLinkedWallets(['3e'.repeat(32), 'ff'.repeat(32)])

    walletInteraction(
      'wi-2',
      { discriminator: 'unauthorizedRequest' },
      'session-1',
    )
    walletInteraction('wi-3', { discriminator: 'unauthorizedRequest' })

    await vi.waitFor(() => expect(tracker.get('wi-3')).toBeDefined())
    expect(tracker.get('wi-2')).toBeUndefined()
    services.sessionRouter.refreshStore({})
  })

  it('sends to a linked wallet a request whose session belongs to a wallet no longer linked', async () => {
    const { tracker } = setup()
    services.sessionRouter.refreshStore({ 'session-old': 'dd'.repeat(32) })
    services.sessionRouter.setLinkedWallets(['3e'.repeat(32)])

    walletInteraction(
      'wi-old-session',
      { discriminator: 'unauthorizedRequest' },
      'session-old',
    )

    await vi.waitFor(() => expect(tracker.get('wi-old-session')).toBeDefined())
    services.sessionRouter.refreshStore({})
    services.sessionRouter.setLinkedWallets([])
  })

  it("cancels a queued request on the dApp's cancelRequest, and tells the dApp", async () => {
    const { tracker, sent } = setup()
    walletInteraction('wi-4', { discriminator: 'unauthorizedRequest' })
    await vi.waitFor(() => expect(tracker.get('wi-4')).toBeDefined())

    walletInteraction('wi-4', { discriminator: 'cancelRequest' })

    await vi.waitFor(() => expect(tracker.get('wi-4')).toBeUndefined())
    await vi.waitFor(() =>
      expect(cancelSuccessSentFor(sent, 'wi-4')).toBe(true),
    )
  })

  it('cancels a queued request on cancelWalletInteraction, and tells the dApp', async () => {
    const { tracker, sent } = setup()
    walletInteraction('wi-5', { discriminator: 'unauthorizedRequest' })
    await vi.waitFor(() => expect(tracker.get('wi-5')).toBeDefined())

    fromTab(
      createMessage.cancelWalletInteraction({
        interactionId: 'wi-5',
        metadata,
      } as any),
    )

    await vi.waitFor(() => expect(tracker.get('wi-5')).toBeUndefined())
    await vi.waitFor(() =>
      expect(cancelSuccessSentFor(sent, 'wi-5')).toBe(true),
    )
  })

  it('cancels a queued dAppRequest on its cancelRequest, and tells the dApp', async () => {
    const { tracker, sent, request } = setup()
    request('req-9')
    await vi.waitFor(() => expect(tracker.get('req-9')).toBeDefined())

    fromTab(
      createMessage.dAppRequest('contentScript', {
        interactionId: 'req-9',
        metadata,
        items: { discriminator: 'cancelRequest' },
      } as any),
    )

    await vi.waitFor(() => expect(tracker.get('req-9')).toBeUndefined())
    await vi.waitFor(() =>
      expect(cancelSuccessSentFor(sent, 'req-9')).toBe(true),
    )
  })
})
