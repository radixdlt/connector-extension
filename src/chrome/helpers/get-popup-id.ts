import { ResultAsync } from 'neverthrow'
import { getSessionStorageArea } from 'utils/browser-detect'

export const getPopupId = () =>
  ResultAsync.fromPromise(
    getSessionStorageArea().get('popupId'),
    (error) => error as Error,
  ).map((items) => {
    const popupId: number | undefined = items['popupId']
    return popupId
  })
