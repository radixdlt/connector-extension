import { ResultAsync } from 'neverthrow'

export const sendMessageToTab = (
  tabId: number,
  message: unknown,
): ResultAsync<undefined, Error> =>
  ResultAsync.fromPromise(
    chrome.tabs.sendMessage(tabId, message),
    (err) => err as Error,
  )
