import { ResultAsync } from 'neverthrow'

export const getActiveWindow = () =>
  ResultAsync.fromPromise(
    chrome.windows.getCurrent(),
    (error) => error as Error,
  )
