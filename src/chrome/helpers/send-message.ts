import { Message } from 'chrome/messages/_types'
import { ResultAsync } from 'neverthrow'

export const sendMessage = (message: Message) =>
  ResultAsync.fromPromise(
    chrome.runtime.sendMessage(message),
    (error) => error as Error,
  )
