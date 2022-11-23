import { ResultAsync } from 'neverthrow'

export const getPopupId = () =>
  ResultAsync.fromPromise(
    chrome.storage.session.get('popupId'),
    (error) => error as Error
  ).map((items) => {
    const popupId: number | undefined = items['popupId']
    return popupId
  })
