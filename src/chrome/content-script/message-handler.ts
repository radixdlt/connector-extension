import { errAsync, okAsync, ResultAsync } from 'neverthrow'
import {
  ConfirmationMessageError,
  Message,
  messageDiscriminator,
  MessageHandler,
  MessageHandlerOutput,
} from '../messages/_types'
import { AppLogger } from 'utils/logger'
import { MessageLifeCycleEvent } from 'chrome/dapp/_types'

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
  (message: Message): MessageHandlerOutput => {
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

      default:
        return errAsync({
          reason: 'unhandledMessageDiscriminator',
        })
    }
  }
