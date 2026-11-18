import type { Message, MessagePayloads } from './_types'

/**
 * What a content script may send to the rest of the extension. Content scripts run
 * in web pages, whose renderer an attacker may control: their messages are
 * untrusted, and only the ones they need get through (dApp requests and their
 * cancellation, confirmations of what they were sent, logs). Anything else, e.g. a
 * wallet's account list or the removal of a link, only comes from the extension's
 * own pages (background, offscreen document, popup, side panel, options).
 */
const contentScriptMessages: ReadonlySet<keyof MessagePayloads> = new Set([
  'dAppRequest',
  'walletInteraction',
  'cancelWalletInteraction',
  'confirmation',
  'log',
])

/** Whether `sender` is one of the extension's own pages (not a web page). */
export const isExtensionPage = (
  sender: chrome.runtime.MessageSender,
  extensionOrigin = chrome.runtime.getURL(''),
) =>
  sender.id === chrome.runtime.id && !!sender.url?.startsWith(extensionOrigin)

/** Whether a message from `sender` may be handled at all. */
export const isAllowedFrom = (
  message: Message,
  sender: chrome.runtime.MessageSender,
  extensionOrigin?: string,
) =>
  isExtensionPage(sender, extensionOrigin) ||
  contentScriptMessages.has(message?.discriminator)
