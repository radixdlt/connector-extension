import { ResultAsync } from 'neverthrow'

export const getDisplayInfo = () =>
  ResultAsync.fromPromise(
    chrome.system.display.getInfo({
      singleUnified: true,
    }),
    (error) => error as Error
  ).map(([display]) => display)
