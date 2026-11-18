import { MessageClient } from 'chrome/messages/message-client'
import { OffscreenMessageHandler } from './message-handler'
import { Logger } from 'tslog'
import { walletConnectionClientFactory } from './wallet-connection/factory'
import { LogsClient } from './logs-client'
import { WalletConnectionClient } from './wallet-connection/wallet-connection-client'
import { MessageSubjects } from 'chrome/messages/subjects'
import { Message } from 'chrome/messages/_types'
import { okAsync } from 'neverthrow'
import { of } from 'rxjs'
import { describe, it, expect, vi } from 'vitest'
import { defaultConnectorExtensionOptions } from 'options'

const logger = new Logger()
const logsClient = LogsClient()
const subjects = MessageSubjects()

const MockTransport = () => ({
  setConnectionPassword: vi.fn(() => okAsync(undefined)),
  setConnectionConfig: vi.fn(),
  connected$: of(true),
  onMessage$: of({} as any),
  connect: vi.fn(),
  restart: vi.fn(),
  destroy: vi.fn(),
})

const createTestSuite = () => {
  const connections = new Map<string, WalletConnectionClient>()
  const transports = new Map<string, ReturnType<typeof MockTransport>>()
  const messageClient = MessageClient(
    OffscreenMessageHandler({
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
        { password: 'password', walletName },
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
})
