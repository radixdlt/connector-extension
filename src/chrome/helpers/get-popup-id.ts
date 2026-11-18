import { sessionStore } from './storage'

export const getPopupId = () => sessionStore.get('popupId')
