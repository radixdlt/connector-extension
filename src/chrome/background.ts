import { createPopupWindow } from 'chrome/helpers/create-popup-window'
import { focusPopupWindow } from 'chrome/helpers/focus-popup-window'
import { getDisplayInfo } from 'chrome/helpers/get-display-info'
import { getExtensionTabsByUrl } from 'chrome/helpers/get-extension-tabs-by-url'
import { getPopupId } from 'chrome/helpers/get-popup-id'
import { setPopupId } from 'chrome/helpers/set-popup-id'
import { config } from 'config'
import { getLogger } from 'loglevel'
import { ok, okAsync, ResultAsync } from 'neverthrow'
import { createChromeApi } from './chrome-api'

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
  chromeAPI.getConnectionPassword().andThen((password) => {
    if (password) return okAsync(true)
    return createOrFocusPopupWindow()
  })

chrome.runtime.onMessage.addListener(async (_, __, sendResponse) => {
  await handleIncomingMessage()
  sendResponse(true)
})

chrome.runtime.onInstalled.addListener(handleIncomingMessage)
