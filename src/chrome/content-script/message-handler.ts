import { addMetadata } from 'chrome/helpers/add-metadata'
import { errAsync, ResultAsync } from 'neverthrow'
import { createMessage } from '../messages/create-message'
import {
  ConfirmationMessageError,
  Message,
  messageDiscriminator,
  MessageHandler,
  MessageHandlerOutput,
  SendMessageWithConfirmation,
} from '../messages/_types'
import { AppLogger } from 'utils/logger'
import { MessageLifeCycleEvent } from 'chrome/dapp/_types'

export type ContentScriptMessageHandlerOptions = {
  logger?: AppLogger
  sendMessageToDapp: (
    message: any
  ) => ResultAsync<undefined, ConfirmationMessageError['error']>
  sendMessageEventToDapp: (
    interactionId: string,
    eventType: MessageLifeCycleEvent
  ) => ResultAsync<undefined, ConfirmationMessageError['error']>
}
export type ContentScriptMessageHandler = ReturnType<
  typeof ContentScriptMessageHandler
>
export const ContentScriptMessageHandler =
  ({
    sendMessageEventToDapp,
    sendMessageToDapp,
    logger,
  }: ContentScriptMessageHandlerOptions): MessageHandler =>
  (
    message: Message,
    sendMessageWithConfirmation: SendMessageWithConfirmation
  ): MessageHandlerOutput => {
    switch (message.discriminator) {
      case messageDiscriminator.sendMessageEventToDapp:
        return sendMessageEventToDapp(
          message.interactionId,
          message.messageEvent
        ).map(() => ({
          sendConfirmation: true,
        }))

      case messageDiscriminator.walletResponse: {
        return sendMessageToDapp(message.data).map(() => ({
          sendConfirmation: true,
        }))
      }

      case messageDiscriminator.incomingDappMessage: {
        return sendMessageEventToDapp(
          message.data.interactionId,
          'receivedByExtension'
        )
          .andThen(() =>
            ResultAsync.combine([
              sendMessageWithConfirmation(
                createMessage.dAppRequest(
                  'contentScript',
                  addMetadata(message.data)
                )
              ),
              sendMessageWithConfirmation(
                createMessage.detectWalletLink('contentScript')
              ),
            ])
          )
          .map(() => ({
            sendConfirmation: false,
          }))
      }

      default:
        return errAsync({
          reason: 'unhandledMessageDiscriminator',
        })
    }
  }
