import { ResultAsync } from 'neverthrow'

export const setPopupId = (popupId: number | undefined) =>
  ResultAsync.fromPromise(
    chrome.storage.session.set({ popupId }),
    (error) => error as Error
  )
