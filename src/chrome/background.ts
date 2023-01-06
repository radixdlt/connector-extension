import { createPopupWindow } from 'chrome/helpers/create-popup-window'
import { focusPopupWindow } from 'chrome/helpers/focus-popup-window'
import { getExtensionTabsByUrl } from 'chrome/helpers/get-extension-tabs-by-url'
import { getPopupId } from 'chrome/helpers/get-popup-id'
import { setPopupId } from 'chrome/helpers/set-popup-id'
import { config } from 'config'
import { ok } from 'neverthrow'
import { closePopup } from './helpers/close-popup'
import { getActiveWindow } from './helpers/get-active-window'
import { chromeLocalStore } from './helpers/chrome-local-store'

const createOrFocusPopupWindow = () =>
  getExtensionTabsByUrl(config.popup.pages.pairing)
    .andThen((extensionTabs) => ok(extensionTabs.length > 0))
    .andThen((isPopupWindowOpen) =>
      getActiveWindow().andThen(({ width, left, height, top }) =>
        isPopupWindowOpen
          ? getPopupId().andThen(focusPopupWindow)
          : createPopupWindow(config.popup.pages.pairing, {
              width,
              left,
              height,
              top,
            }).andThen((popup) => setPopupId(popup?.id))
      )
    )

const handleIncomingMessage = () =>
  chromeLocalStore
    .getItem('connectionPassword')
    .andThen(({ connectionPassword }) =>
      connectionPassword ? closePopup() : createOrFocusPopupWindow()
    )

const handleConnectionPasswordChange = async (changes: {
  [key: string]: chrome.storage.StorageChange
}) => {
  if (changes['connectionPassword']?.newValue) {
    setTimeout(() => {
      closePopup()
    }, config.popup.closeDelayTime)
  }
}

chrome.runtime.onMessage.addListener(handleIncomingMessage)
chrome.storage.onChanged.addListener(handleConnectionPasswordChange)
chrome.action.onClicked.addListener(createOrFocusPopupWindow)

if (config.popup.showOnInstall) {
  chrome.runtime.onInstalled.addListener(handleIncomingMessage)
}
