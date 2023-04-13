import { ResultAsync } from 'neverthrow'

export const getTabById = (tabId: number) =>
  ResultAsync.fromPromise(chrome.tabs.get(tabId), (err) => err as Error)
