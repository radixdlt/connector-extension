import { MessagesRouter } from 'message-router'
import { errAsync, okAsync } from 'neverthrow'
import { filter, firstValueFrom } from 'rxjs'
import { Logger } from 'tslog'
import { BackgroundMessageHandler } from '../background/message-handler'
import { ContentScriptMessageHandler } from '../content-script/message-handler'
import { OffscreenMessageHandler } from '../offscreen/message-handler'
import { createMessage } from './create-message'
import { MessageClient } from './message-client'
import { MessageSubjects } from './subjects'

const logger = new Logger()

const dAppRequestQueue = { add: () => okAsync(undefined) } as any

const createTestHelper = ({
  messageRouter = MessagesRouter({ logger }),
  messageClientSubjects = MessageSubjects(),
  backgroundMessageClient = MessageClient(
    BackgroundMessageHandler({
      logger,
      getConnectionPassword: () => okAsync(''),
      openParingPopup: () => okAsync(undefined),
    }),
    'background',
    {
      logger,
      subjects: messageClientSubjects,
      sendMessage: (message, tabId?: number) => {
        logger.debug('sendMessage', { message, tabId })
        messageClientSubjects.messageSubject.next({ message, tabId })

        return okAsync(undefined)
      },
    }
  ),
  offScreenMessageClient = MessageClient(
    OffscreenMessageHandler({
      logger,
      messageRouter,
      dAppRequestQueue,
      connectorClient: {
        connect: () => {},
        disconnect: () => {},
        setConnectionPassword: () => okAsync(undefined),
      },
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
    }
  ),
  contentScriptMessageClient = MessageClient(
    ContentScriptMessageHandler({
      sendMessageEventToDapp: () => okAsync(undefined),
      sendMessageToDapp: () => okAsync(undefined),
      logger,
    }),
    'contentScript',
    {
      logger,
      subjects: messageClientSubjects,
      sendMessage: (message, tabId?: number) => {
        logger.debug('sendMessage', message)
        messageClientSubjects.messageSubject.next({ message, tabId })
        return okAsync(undefined)
      },
    }
  ),
}: Partial<{
  messagesRouter: MessagesRouter
  backgroundMessageClient: MessageClient
  offScreenMessageClient: MessageClient
  contentScriptMessageClient: MessageClient
  messageRouter: MessagesRouter
  messageClientSubjects: MessageSubjects
}>) => {
  const mockIncomingDappMessage = (message: Record<string, any>) => {
    contentScriptMessageClient.onMessage(
      createMessage.incomingDappMessage('dApp', message)
    )
  }

  const mockIncomingWalletMessage = (
    message: Record<string, any>,
    tabId?: number
  ) => {
    offScreenMessageClient.onMessage(
      createMessage.incomingWalletMessage('wallet', message),
      tabId
    )
  }

  return {
    subjects: messageClientSubjects,
    backgroundMessageClient,
    offScreenMessageClient,
    contentScriptMessageClient,
    mockIncomingDappMessage,
    mockIncomingWalletMessage,
    messageRouter,
  }
}

describe('message client', () => {
  it('should send dApp request to wallet', async () => {
    const testHelper = createTestHelper({})
    testHelper.mockIncomingDappMessage({ interactionId: '123' })

    await Promise.all([
      firstValueFrom(
        testHelper.subjects.messageSubject.pipe(
          filter(
            ({ message }) =>
              message.discriminator === 'confirmation' &&
              message.source === 'offScreen'
          )
        )
      ),
      firstValueFrom(
        testHelper.subjects.messageSubject.pipe(
          filter(({ message }) => message.discriminator === 'detectWalletLink')
        )
      ),
    ])
  })

  // offScreenPage does not have have access to the chrome tabs API
  // so it has to proxy the message through background message handler
  it('should send wallet response to dApp', async () => {
    const testHelper = createTestHelper({})
    testHelper.messageRouter.add(1, '456', '')
    testHelper.mockIncomingWalletMessage({ interactionId: '456' }, 1)

    await Promise.all([
      firstValueFrom(
        testHelper.subjects.messageSubject.pipe(
          filter(({ message }) => message.discriminator === 'sendMessageToTab')
        )
      ),
      firstValueFrom(
        testHelper.subjects.messageSubject.pipe(
          filter(({ message }) => message.discriminator === 'walletResponse')
        )
      ),
      firstValueFrom(
        testHelper.subjects.messageSubject.pipe(
          filter(
            ({ message }) =>
              message.discriminator === 'confirmation' &&
              message.source === 'contentScript'
          )
        )
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
          getConnectionPassword: () => okAsync(''),
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
        }
      ),
    })

    testHelper.messageRouter.add(1, '456', '')
    testHelper.mockIncomingWalletMessage({ interactionId: '456' }, 1)

    await Promise.all([
      firstValueFrom(
        testHelper.subjects.messageSubject.pipe(
          filter(({ message }) => message.discriminator === 'sendMessageToTab')
        )
      ),
      firstValueFrom(
        testHelper.subjects.messageSubject.pipe(
          filter(
            ({ message }) =>
              message.discriminator === 'confirmation' &&
              message.source === 'background' &&
              message.success === false &&
              message.error.reason === 'tabNotFound'
          )
        )
      ),
    ])
  })
})
