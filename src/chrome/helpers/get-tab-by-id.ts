import { err, ok, ResultAsync } from 'neverthrow'

export const getTabById = (tabId: number) =>
  ResultAsync.fromPromise(
    chrome.tabs.get(tabId),
    (err) => err as Error
  ).andThen((tab) => (tab ? ok(tab) : err(new Error('Tab not found'))))
