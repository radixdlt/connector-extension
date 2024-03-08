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

const logger = new Logger()
const logsClient = LogsClient()
const subjects = MessageSubjects()

const createTestSuite = () => {
  const connections = new Map<string, WalletConnectionClient>()
  const messageClient = MessageClient(
    OffscreenMessageHandler({
      connectionsMap: connections,
      logger,
      walletConnectionClientFactory: (input) => {
        return walletConnectionClientFactory({
          ...input,
          connectorClient: {
            setConnectionPassword: () => okAsync(undefined),
            connected$: of(true),
            onMessage$: of({} as any),
            connect: () => void 0,
            destroy: () => void 0,
          } as any,
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
  return { messageClient, connections }
}

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
    })

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
    })

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
    })

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
    })
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
    })
    expect(connections.get('1')).toBeDefined()
    expect(connections.get('2')).toBeDefined()
  })
})
