import type { ResultAsync } from 'neverthrow'
import { fromEventPattern } from 'rxjs'
import type { AnswerOf, Message } from 'chrome/messages/_types'
import {
  confirmationTimeoutReason,
  waitForConfirmation,
} from 'chrome/messages/wait-for-confirmation'

type OnMessage = (message: Message) => void

/**
 * Sends `request` to the offscreen document, which holds the wallet links, and
 * resolves with the data of its confirmation. Fails after `timeoutMs` (e.g. while
 * the offscreen document is not running), and never leaves a listener behind.
 */
export const requestFromOffscreen = <M extends Message>(
  request: M,
  timeoutMs: number,
): ResultAsync<AnswerOf<M>, Error> => {
  const confirmation = waitForConfirmation<AnswerOf<M>>(
    fromEventPattern<Message>(
      (listener) => chrome.runtime.onMessage.addListener(listener as OnMessage),
      (listener) =>
        chrome.runtime.onMessage.removeListener(listener as OnMessage),
      // Only the message, not its sender.
      (message: Message) => message,
    ),
    request.messageId,
    timeoutMs,
  ).mapErr(
    ({ reason }) =>
      new Error(
        reason === confirmationTimeoutReason
          ? 'the offscreen document did not answer'
          : reason,
      ),
  )
  // The answer comes as a separate confirmation message; the direct response of
  // `sendMessage` (or its "port closed" error) does not matter.
  Promise.resolve(chrome.runtime.sendMessage(request)).catch(() => {})
  return confirmation
}
