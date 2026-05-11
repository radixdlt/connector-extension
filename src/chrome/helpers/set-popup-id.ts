import { ResultAsync } from 'neverthrow'
import { getSessionStorageArea } from 'utils/browser-detect'

export const setPopupId = (popupId: number | undefined) =>
  ResultAsync.fromPromise(
    getSessionStorageArea().set({ popupId }),
    (error) => error as Error,
  )
