import { ResultAsync } from 'neverthrow'

export const setPopupId = (popupId: number | undefined) =>
  ResultAsync.fromPromise(
    chrome.storage.local.set({ popupId }),
    (error) => error as Error
  )
