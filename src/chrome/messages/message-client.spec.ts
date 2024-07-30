import { MessagesRouter } from 'chrome/offscreen/wallet-connection/messages-router'
import { errAsync, okAsync } from 'neverthrow'
import { Observable, filter, firstValueFrom, of } from 'rxjs'
import { Logger } from 'tslog'
import { BackgroundMessageHandler } from '../background/message-handler'
import { createMessage } from './create-message'
import { MessageClient } from './message-client'
import { MessageSubjects } from './subjects'
import { ContentScriptMessageHandler } from 'chrome/content-script/message-handler'
import { OffscreenMessageHandler } from 'chrome/offscreen/message-handler'
import { walletConnectionClientFactory } from 'chrome/offscreen/wallet-connection/factory'
import { WalletConnectionMessageHandler } from 'chrome/offscreen/wallet-connection/message-handler'
import { Message } from './_types'
import { SessionRouter } from 'chrome/offscreen/session-router'

const logger = new Logger()

const dAppRequestQueue = { add: () => okAsync(undefined) } as any
const extensionToWalletQueue = { add: () => okAsync(undefined) } as any
const incomingWalletMessageQueue = { add: () => okAsync(undefined) } as any

const createInput = (subjects: MessageSubjects) => ({
  logger,
  subjects,
  sendMessage: (message: Message, tabId?: number) => {
    logger.debug('sendMessage', { message, tabId })
    subjects.messageSubject.next({ message, tabId })

    return okAsync(undefined)
  },
})

const createTestHelper = ({
  messagesRouter = MessagesRouter({ logger }),
  messageClientSubjects = MessageSubjects(),
  backgroundMessageClient = MessageClient(
    BackgroundMessageHandler({
      logger,
      getConnections: () => okAsync({}),
      openParingPopup: () => okAsync(undefined),
    }),
    'background',
    createInput(messageClientSubjects),
  ),
  walletConnectionMessageClient = MessageClient(
    WalletConnectionMessageHandler({
      dAppRequestQueue,
      extensionToWalletQueue,
      incomingWalletMessageQueue,
      messagesRouter,
      sessionRouter: SessionRouter(),
      logger,
      walletPublicKey: 'random-mock-client-id',
    }),
    'offScreen',
    createInput(messageClientSubjects),
  ),

  offScreenMessageClient = MessageClient(
    OffscreenMessageHandler({
      logger,
      connectionsMap: new Map([
        [
          '456',
          walletConnectionClientFactory({
            connection: {
              password: '',
              walletName: 'Test Mock Wallet',
              walletPublicKey: 'mock',
              accounts: [],
            },
            logger,
            messagesRouter,
            connectorClient: {
              connect: () => {},
              disconnect: () => {},
              setConnectionPassword: () => okAsync(undefined),
              connected$: of(false),
              onMessage$: new Observable(),
            } as any,
          }),
        ],
      ]),
      walletConnectionClientFactory: () => ({}) as any,
    } as any),
    'offScreen',
    {
      logger,
      subjects: messageClientSubjects,
      sendMessage: (value, tabId?: number) => {
        const message =
          value.source !== 'background' && tabId
            ? createMessage.sendMessageToTab('offScreen', tabId, value)
            : value
        logger.debug('sendMessage', message)
        messageClientSubjects.messageSubject.next({ message, tabId })
        return okAsync(undefined)
      },
    },
  ),
  contentScriptMessageClient = MessageClient(
    ContentScriptMessageHandler({
      sendMessageEventToDapp: () => okAsync(undefined),
      sendMessageToDapp: () => okAsync(undefined),
      logger,
    }),
    'contentScript',
    createInput(messageClientSubjects),
  ),
}: Partial<{
  messagesRouter: MessagesRouter
  backgroundMessageClient: MessageClient
  offScreenMessageClient: MessageClient
  contentScriptMessageClient: MessageClient
  walletConnectionMessageClient: MessageClient
  messageRouter: MessagesRouter
  messageClientSubjects: MessageSubjects
}>) => {
  const mockIncomingDappMessage = (message: Record<string, any>) => {
    contentScriptMessageClient.onMessage(
      createMessage.incomingDappMessage('dApp', message),
    )
  }

  const mockIncomingWalletMessage = (
    message: Record<string, any>,
    tabId?: number,
  ) => {
    walletConnectionMessageClient.onMessage(
      createMessage.incomingWalletMessage('wallet', message),
      tabId,
    )
  }

  return {
    subjects: messageClientSubjects,
    backgroundMessageClient,
    offScreenMessageClient,
    contentScriptMessageClient,
    mockIncomingDappMessage,
    mockIncomingWalletMessage,
    messagesRouter,
  }
}

describe('message client', () => {
  // offScreenPage does not have have access to the chrome tabs API
  // so it has to proxy the message through background message handler
  it('should send wallet response to dApp', async () => {
    const testHelper = createTestHelper({})
    testHelper.messagesRouter.add(1, '456', {
      origin: 'http://localhost',
      networkId: 1,
    })
    testHelper.mockIncomingWalletMessage({ interactionId: '456' }, 1)

    await Promise.all([
      firstValueFrom(
        testHelper.subjects.messageSubject.pipe(
          filter(({ message }) => message.discriminator === 'sendMessageToTab'),
        ),
      ),
      firstValueFrom(
        testHelper.subjects.messageSubject.pipe(
          filter(({ message }) => message.discriminator === 'walletResponse'),
        ),
      ),
      firstValueFrom(
        testHelper.subjects.messageSubject.pipe(
          filter(
            ({ message }) =>
              message.discriminator === 'confirmation' &&
              message.source === 'contentScript',
          ),
        ),
      ),
    ])
  })

  it('should fail to send message to dApp if tab is missing', async () => {
    const subjects = MessageSubjects()
    const testHelper = createTestHelper({
      messageClientSubjects: subjects,
      backgroundMessageClient: MessageClient(
        BackgroundMessageHandler({
          logger,
          getConnections: () => okAsync({}),
          openParingPopup: () => okAsync(undefined),
        }),
        'background',
        {
          logger,
          subjects,
          sendMessage: (message, tabId?: number) => {
            if (message.discriminator === 'walletResponse')
              return errAsync({
                reason: 'tabNotFound',
                message: 'could not find tab, user may have closed it',
              })
            subjects.messageSubject.next({ message, tabId })
            return okAsync(undefined)
          },
        },
      ),
    })

    testHelper.messagesRouter.add(1, '456', { origin: 'origin', networkId: 1 })
    testHelper.mockIncomingWalletMessage({ interactionId: '456' }, 1)

    await Promise.all([
      firstValueFrom(
        testHelper.subjects.messageSubject.pipe(
          filter(({ message }) => message.discriminator === 'sendMessageToTab'),
        ),
      ),
      firstValueFrom(
        testHelper.subjects.messageSubject.pipe(
          filter(
            ({ message }) =>
              message.discriminator === 'confirmation' &&
              message.source === 'background' &&
              message.success === false &&
              message.error.reason === 'tabNotFound',
          ),
        ),
      ),
    ])
  })
})
