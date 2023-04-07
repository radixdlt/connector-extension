import { MessagesRouter } from 'message-router'
import { okAsync } from 'neverthrow'
import { filter, firstValueFrom } from 'rxjs'
import { Logger } from 'tslog'
import { BackgroundMessageHandler } from '../background/message-handler'
import { ContentScriptMessageHandler } from '../content-script/message-handler'
import { OffscreenMessageHandler } from '../offscreen/message-handler'
import { createMessage } from './create-message'
import { MessageClient } from './message-client'
import { MessageSubjects } from './subjects'

const logger = new Logger()

const messageClientSubjects = MessageSubjects()

let backgroundMessageClient: MessageClient
let offScreenMessageClient: MessageClient
let contentScriptMessageClient: MessageClient
let messageRouter: MessagesRouter

const dAppRequestQueue = { add: () => okAsync(undefined) } as any

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

describe('message client', () => {
  beforeEach(() => {
    messageRouter = MessagesRouter()

    backgroundMessageClient = MessageClient(
      BackgroundMessageHandler({
        logger,
        getConnectionPassword: () => okAsync(''),
        openParingPopup: () => okAsync(undefined),
      }),
      'background',
      {
        subjects: messageClientSubjects,
        sendMessage: (message, tabId?: number) => {
          logger.debug('sendMessage', { message, tabId })
          messageClientSubjects.messageSubject.next({ message, tabId })

          return okAsync(undefined)
        },
      }
    )

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
    )

    contentScriptMessageClient = MessageClient(
      ContentScriptMessageHandler({
        sendMessageEventToDapp: () => okAsync(undefined),
        sendMessageToDapp: () => okAsync(undefined),
        logger,
      }),
      'contentScript',
      {
        subjects: messageClientSubjects,
        sendMessage: (message, tabId?: number) => {
          logger.debug('sendMessage', message)
          messageClientSubjects.messageSubject.next({ message, tabId })
          return okAsync(undefined)
        },
      }
    )
  })

  it('should send dApp request to wallet', async () => {
    mockIncomingDappMessage({ interactionId: '123' })

    await Promise.all([
      firstValueFrom(
        messageClientSubjects.messageSubject.pipe(
          filter(
            ({ message }) =>
              message.discriminator === 'confirmation' &&
              message.source === 'offScreen'
          )
        )
      ),
      firstValueFrom(
        messageClientSubjects.messageSubject.pipe(
          filter(({ message }) => message.discriminator === 'detectWalletLink')
        )
      ),
    ])
  })

  // offScreenPage does not have have access to the chrome tabs API
  // so it has to proxy the message through background message handler
  it('should send wallet response to dApp', async () => {
    messageRouter.add(1, '456')
    mockIncomingWalletMessage({ interactionId: '456' }, 1)

    await Promise.all([
      firstValueFrom(
        messageClientSubjects.messageSubject.pipe(
          filter(({ message }) => message.discriminator === 'sendMessageToTab')
        )
      ),
      firstValueFrom(
        messageClientSubjects.messageSubject.pipe(
          filter(({ message }) => message.discriminator === 'walletResponse')
        )
      ),
      firstValueFrom(
        messageClientSubjects.messageSubject.pipe(
          filter(
            ({ message }) =>
              message.discriminator === 'confirmation' &&
              message.source === 'contentScript'
          )
        )
      ),
    ])
  })
})
