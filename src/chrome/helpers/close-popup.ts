import { okAsync } from 'neverthrow'
import { closePopupById } from './close-popup-by-id'
import { getPopupId } from './get-popup-id'

export const closePopup = () =>
  getPopupId().andThen((id) => (id ? closePopupById(id) : okAsync(true)))
