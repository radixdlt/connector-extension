import type { AppLogger } from 'utils/logger'
import type { Message } from './_types'
import type { MessageClient } from './message-client'
import { isAllowedFrom } from './trusted-senders'

/**
 * The content script asks for its tab's id with a message of its own, not one of the
 * extension's (see `getTabId`): the background answers it.
 */
export const isTabIdRequest = (message: unknown) =>
  (message as { type?: unknown } | undefined)?.type === 'getTabId'

/**
 * The runtime's messages for `messageClient`, from the extension's pages and, only
 * those they need, from web pages (see `isAllowedFrom`); any other is dropped, and
 * logged. The request for a tab's id is not one of them: neither handled nor logged.
 */
export const runtimeMessageListener =
  (messageClient: MessageClient, logger: AppLogger) =>
  (message: Message, sender: chrome.runtime.MessageSender) => {
    if (isTabIdRequest(message)) return
    // Web pages (through the content script) may only send what they need.
    if (!isAllowedFrom(message, sender)) {
      logger.warn('dropped a message a web page may not send', {
        discriminator: message?.discriminator,
      })
      return
    }
    messageClient.onMessage(message, sender.tab?.id)
  }
