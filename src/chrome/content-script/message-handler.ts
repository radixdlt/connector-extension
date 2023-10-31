import { addMetadata } from 'chrome/helpers/add-metadata'
import { errAsync, okAsync, ResultAsync } from 'neverthrow'
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
    data: { interactionId: string; metadata: { origin: string } },
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
      case messageDiscriminator.sendMessageEventToDapp: {
        return sendMessageEventToDapp(message.data, message.messageEvent).map(
          () => ({
            sendConfirmation: true,
          }),
        )
      }

      case messageDiscriminator.walletResponse: {
        const walletResponse = message.data.walletResponse
        const { origin } = message.data.metadata

        const doesOriginMatch = window.location.origin === origin

        return doesOriginMatch
          ? sendMessageToDapp(walletResponse).map(() => ({
              sendConfirmation: true,
            }))
          : okAsync({ sendConfirmation: false })
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
              {
                interactionId: message.data.interactionId,
                metadata: { origin: window.location.origin },
              },
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
