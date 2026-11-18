import type { ResultAsync } from 'neverthrow'
import { okAsync } from 'neverthrow'
import type {
  ConfirmationMessageError,
  MessageHandler,
} from '../messages/_types'
import { handleMessages } from '../messages/_types'
import type { AppLogger } from 'utils/logger'
import type { MessageLifeCycleEvent } from 'chrome/dapp/_types'

export type ContentScriptMessageHandlerOptions = {
  logger?: AppLogger
  sendMessageToDapp: (
    message: Record<string, unknown>,
  ) => ResultAsync<undefined, ConfirmationMessageError['error']>
  sendMessageEventToDapp: (
    data: { interactionId: string; metadata: { origin: string } },
    eventType: MessageLifeCycleEvent,
  ) => ResultAsync<undefined, ConfirmationMessageError['error']>
}
export type ContentScriptMessageHandler = ReturnType<
  typeof ContentScriptMessageHandler
>
export const ContentScriptMessageHandler = ({
  sendMessageEventToDapp,
  sendMessageToDapp,
}: ContentScriptMessageHandlerOptions): MessageHandler =>
  handleMessages({
    sendMessageEventToDapp: (message) =>
      sendMessageEventToDapp(message.data, message.messageEvent).map(() => ({
        sendConfirmation: true,
      })),
    walletResponse: (message) => {
      const walletResponse = message.data.walletResponse
      const origin = message.data.metadata?.origin

      const doesOriginMatch = window.location.origin === origin

      return doesOriginMatch && walletResponse
        ? sendMessageToDapp(walletResponse).map(() => ({
            sendConfirmation: true,
          }))
        : okAsync({ sendConfirmation: false })
    },
  })
