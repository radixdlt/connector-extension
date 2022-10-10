import { ResultAsync } from 'neverthrow'

export const focusPopupWindow = (popupId: number | undefined) =>
  ResultAsync.fromPromise(
    popupId
      ? chrome.windows.update(popupId, { focused: true })
      : Promise.reject(Error('popupId not provided')),
    (error) => error as Error
  )
