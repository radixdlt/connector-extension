import { ResultAsync } from 'neverthrow'

export const focusWindow = (windowId: number | undefined) =>
  ResultAsync.fromPromise(
    windowId
      ? chrome.windows.update(windowId, { focused: true })
      : Promise.reject(Error('popupId not provided')),
    (error) => error as Error,
  )
