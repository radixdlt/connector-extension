import { ResultAsync } from 'neverthrow'

export const closePopupById = (id: number) =>
  ResultAsync.fromPromise(chrome.windows.remove(id), (error) => error as Error)
