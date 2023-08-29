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
import { getConnectionPassword } from 'chrome/helpers/get-connection-password'
import { sendMessage } from 'chrome/messages/send-message'

export type ContentScriptMessageHandlerOptions = {
  logger?: AppLogger
  sendMessageToDapp: (
    message: any,
  ) => ResultAsync<undefined, ConfirmationMessageError['error']>
  sendMessageEventToDapp: (
    interactionId: string,
    eventType: MessageLifeCycleEvent,
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
    sendMessageWithConfirmation: SendMessageWithConfirmation,
  ): MessageHandlerOutput => {
    switch (message?.discriminator) {
      case messageDiscriminator.sendMessageEventToDapp:
        return sendMessageEventToDapp(
          message.interactionId,
          message.messageEvent,
        ).map(() => ({
          sendConfirmation: true,
        }))

      case messageDiscriminator.walletResponse: {
        return sendMessageToDapp(message.data).map(() => ({
          sendConfirmation: true,
        }))
      }

      case messageDiscriminator.incomingDappMessage: {
        switch (message.data?.discriminator) {
          case messageDiscriminator.extensionStatus:
            return getConnectionPassword()
              .andThen((connectionPassword) =>
                sendMessageToDapp(
                  createMessage.extensionStatus(!!connectionPassword),
                ).map(() => ({ sendConfirmation: false })),
              )
              .mapErr((error) => {
                return {
                  reason: 'unableToGetConnectionPassword',
                }
              })
          case messageDiscriminator.openParingPopup:
            return sendMessage(createMessage.openParingPopup())
              .map(() => ({
                sendConfirmation: false,
              }))
              .mapErr(() => ({ reason: 'unableToOpenParingPopup' }))
          default:
            return sendMessageEventToDapp(
              message.data.interactionId,
              'receivedByExtension',
            )
              .andThen(() =>
                ResultAsync.combine([
                  sendMessageWithConfirmation(
                    createMessage.dAppRequest(
                      'contentScript',
                      addMetadata(message.data),
                    ),
                  ),
                  sendMessageWithConfirmation(
                    createMessage.detectWalletLink('contentScript'),
                  ),
                ]),
              )
              .map(() => ({
                sendConfirmation: false,
              }))
        }
      }

      default:
        return errAsync({
          reason: 'unhandledMessageDiscriminator',
        })
    }
  }
