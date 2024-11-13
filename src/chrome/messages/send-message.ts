import { err, ok, ResultAsync } from 'neverthrow'

import { ConfirmationMessageError, Message } from './_types'
import { getTabById } from 'chrome/helpers/get-tab-by-id'
import { sendMessage as chromeSendMessage } from 'chrome/helpers/send-message'
import { sendMessageToTab as chromeSendMessageToTab } from 'chrome/helpers/send-message-to-tab'
import { getTabsByOrigin } from 'chrome/helpers/get-tabs-by-origin'

export type SendMessage = typeof sendMessage
export const sendMessage = (
  message: Message,
  tabId?: number,
): ResultAsync<undefined, ConfirmationMessageError['error']> => {
  const canSendMessageToTab = message.source === 'background' && tabId

  if (canSendMessageToTab) {
    return getTabById(tabId)
      .mapErr((error) => ({
        reason: 'tabNotFound',
        message: 'could not find tab, user may have closed it',
        jsError: error,
      }))
      .orElse((error) => {
        if (message.discriminator === 'walletResponse') {
          const maybeOrigin: string | undefined = message.data?.metadata.origin
          if (maybeOrigin) {
            return getTabsByOrigin(maybeOrigin)
              .andThen((tabs) => (tabs[0] ? ok(tabs[0]) : err(error)))
              .orElse(() => err(error))
          }
        }

        return err(error)
      })
      .andThen((tab) =>
        chromeSendMessageToTab(tab.id!, message).mapErr((error) => ({
          reason: 'couldNotSendMessageToTab',
          jsError: error,
        })),
      )
  }

  return chromeSendMessage(message).mapErr((error) => ({
    reason: 'couldNotSendMessage',
    jsError: error,
  }))
}
