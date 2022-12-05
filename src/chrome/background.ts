import { createPopupWindow } from 'chrome/helpers/create-popup-window'
import { focusPopupWindow } from 'chrome/helpers/focus-popup-window'
import { getDisplayInfo } from 'chrome/helpers/get-display-info'
import { getExtensionTabsByUrl } from 'chrome/helpers/get-extension-tabs-by-url'
import { getPopupId } from 'chrome/helpers/get-popup-id'
import { setPopupId } from 'chrome/helpers/set-popup-id'
import { config } from 'config'
import { getLogger } from 'loglevel'
import { ok, ResultAsync } from 'neverthrow'
import { createChromeApi } from './chrome-api'
import { closePopup } from './helpers/close-popup'

const logger = getLogger('background')

const chromeAPI = createChromeApi(config.storage.key, logger)

const createOrFocusPopupWindow = () =>
  ResultAsync.combine([
    getExtensionTabsByUrl(config.popup.pages.pairing).andThen((extensionTabs) =>
      ok(extensionTabs.length > 0)
    ),
    getDisplayInfo(),
  ]).andThen((values) => {
    const isPopupWindowOpen = values[0] as boolean
    const displayInfo = values[1] as chrome.system.display.DisplayInfo

    return isPopupWindowOpen
      ? getPopupId().andThen(focusPopupWindow)
      : createPopupWindow(
          config.popup.pages.pairing,
          displayInfo.bounds.width
        ).andThen((popup) => setPopupId(popup?.id))
  })

const handleIncomingMessage = () =>
  chromeAPI
    .getConnectionPassword()
    .andThen((connectionPassword) =>
      connectionPassword ? closePopup() : createOrFocusPopupWindow()
    )

const handleConnectionPasswordChange = async (changes: {
  [key: string]: chrome.storage.StorageChange
}) => {
  const connectionPasswordKey = Object.keys(changes).find((key) =>
    key.includes(':connectionPassword')
  )
  if (connectionPasswordKey && changes[connectionPasswordKey].newValue) {
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
