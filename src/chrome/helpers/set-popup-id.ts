import { sessionStore } from './storage'

export const setPopupId = (popupId: number | undefined) =>
  sessionStore.set('popupId', popupId)
