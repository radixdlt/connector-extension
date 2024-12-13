import { createPopupWindow } from 'chrome/helpers/create-popup-window'
import { focusWindow } from 'chrome/helpers/focus-window'
import { getExtensionTabsByUrl } from 'chrome/helpers/get-extension-tabs-by-url'
import { getPopupId } from 'chrome/helpers/get-popup-id'
import { setPopupId } from 'chrome/helpers/set-popup-id'
import { config } from 'config'
import { ok } from 'neverthrow'
import { getActiveWindow } from './get-active-window'

export const openParingPopup = () =>
  getExtensionTabsByUrl(config.popup.pages.pairing)
    .andThen((extensionTabs) => ok(extensionTabs.length > 0))
    .andThen((isPopupWindowOpen) =>
      getActiveWindow().andThen(({ width, left, height, top }) =>
        isPopupWindowOpen
          ? getPopupId().andThen(focusWindow)
          : createPopupWindow(config.popup.pages.pairing, {
              width,
              left,
              height,
              top,
            }).andThen((popup) => setPopupId(popup?.id)),
      ),
    )

export type OpenParingPopup = typeof openParingPopup
