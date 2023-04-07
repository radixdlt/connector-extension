import { ResultAsync } from 'neverthrow'

import { ConfirmationMessageError, Message } from './_types'
import { getTabById } from 'chrome/helpers/get-tab-by-id'
import { sendMessage as chromeSendMessage } from 'chrome/helpers/send-message'
import { sendMessageToTab as chromeSendMessageToTab } from 'chrome/helpers/send-message-to-tab'
import { createMessage } from './create-message'

export type SendMessage = typeof sendMessage
export const sendMessage = (
  message: Message,
  tabId?: number
): ResultAsync<undefined, ConfirmationMessageError['error']> => {
  const canSendMessageToTab = message.source === 'background' && tabId
  const shouldProxyMessageThroughBackground =
    message.source !== 'background' && tabId

  if (canSendMessageToTab)
    return getTabById(tabId)
      .mapErr((error) => ({
        reason: 'tabNotFound',
        message: 'could not find tab, user may have closed it',
        jsError: error,
      }))
      .andThen(() =>
        chromeSendMessageToTab(tabId, message).mapErr((error) => ({
          reason: 'couldNotSendMessageToTab',
          jsError: error,
        }))
      )

  return chromeSendMessage(
    shouldProxyMessageThroughBackground
      ? createMessage.sendMessageToTab(message.source, tabId, message)
      : message
  ).mapErr((error) => ({
    reason: 'couldNotSendMessage',
    jsError: error,
  }))
}
