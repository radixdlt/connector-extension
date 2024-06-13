import { Message } from 'chrome/messages/_types'
import { ResultAsync } from 'neverthrow'

export const sendMessage = (message: Message) =>
  ResultAsync.fromPromise(
    chrome.runtime.id
      ? chrome.runtime.sendMessage(message)
      : Promise.reject({ reason: 'NoChromeRuntimeId' }),
    (error) => error as Error,
  )
