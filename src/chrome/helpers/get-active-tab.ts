import { ResultAsync } from 'neverthrow'

export const getActiveTab = () =>
  ResultAsync.fromPromise(
    chrome.tabs.query({ active: true, lastFocusedWindow: true }),
    (error) => error as Error
  ).map((tabs) => tabs[0])
