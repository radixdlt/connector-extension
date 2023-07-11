import { ResultAsync } from 'neverthrow'

export const getActiveTab = () =>
  ResultAsync.fromPromise(
    chrome.tabs.query({ active: true, currentWindow: true }),
    (error) => error as Error,
  ).map((tabs) => tabs[0])
