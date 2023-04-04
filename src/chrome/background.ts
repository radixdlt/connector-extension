import { createPopupWindow } from 'chrome/helpers/create-popup-window'
import { focusPopupWindow } from 'chrome/helpers/focus-popup-window'
import { getExtensionTabsByUrl } from 'chrome/helpers/get-extension-tabs-by-url'
import { getPopupId } from 'chrome/helpers/get-popup-id'
import { setPopupId } from 'chrome/helpers/set-popup-id'
import { config } from 'config'
import { ok, okAsync } from 'neverthrow'
import { closePopup } from './helpers/close-popup'
import { getActiveWindow } from './helpers/get-active-window'
import { chromeLocalStore } from './helpers/chrome-local-store'
// @ts-ignore
import content from './content?script'
import { isOffscreenReady } from 'chrome/offscreen/helpers'
import { createOffscreen } from 'chrome/offscreen/create-offscreen'

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

const handleIncomingMessage = (message: unknown) =>
  chromeLocalStore
    .getItem('connectionPassword')
    .andThen(({ connectionPassword }) => {
      if (isOffscreenReady(message)) {
        return okAsync(chrome.runtime.sendMessage({ connectionPassword }))
      }
      return connectionPassword ? closePopup() : createOrFocusPopupWindow()
    })

const handleConnectionPasswordChange = async (changes: {
  [key: string]: chrome.storage.StorageChange
}) => {
  if (changes['connectionPassword']?.newValue) {
    chrome.runtime.sendMessage({
      connectionPassword: changes['connectionPassword']?.newValue,
    })
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

chrome.runtime.onInstalled.addListener(async () => {
  for (const tab of await chrome.tabs.query({})) {
    try {
      if (tab.id) {
        await chrome.scripting.executeScript({
          target: {
            tabId: tab.id,
          },
          files: [content],
        })
      }
    } catch (err) {}
  }
})

if (config.offscreen.hasOffscreen) {
  createOffscreen()
}
