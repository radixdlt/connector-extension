import { createPopupWindow } from 'chrome/helpers/create-popup-window'
import { focusPopupWindow } from 'chrome/helpers/focus-popup-window'
import { getDisplayInfo } from 'chrome/helpers/get-display-info'
import { getExtensionTabsByUrl } from 'chrome/helpers/get-extension-tabs-by-url'
import { getPopupId } from 'chrome/helpers/get-popup-id'
import { sessionStore } from 'chrome/helpers/set-item'
import { setPopupId } from 'chrome/helpers/set-popup-id'
import { config } from 'config'
import { getLogger } from 'loglevel'
import { ok, okAsync, ResultAsync } from 'neverthrow'
import { makeChromeApi } from 'storage/storage-client'

const logger = getLogger('background')

const chromeAPI = makeChromeApi(config.storage.key, logger)

const handleActiveConnection = async (
  status: 'connected' | 'disconnected',
  tabId: number
) => {
  logger.debug(`🔌 tabId: ${tabId} connection status: ${status}`)
  return status === 'connected'
    ? sessionStore.setItem({ [`connection:${tabId}`]: true })
    : sessionStore.removeItem(`connection:${tabId}`)
}

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

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  chromeAPI.getConnectionPassword().andThen((password) => {
    if (password) return okAsync(true)
    sendResponse(true)
    return createOrFocusPopupWindow()
  })

  if ('connectionStatus' in message && sender.tab?.id)
    await handleActiveConnection(message.connectionStatus, sender.tab.id)
  sendResponse(true)
})

chrome.runtime.onInstalled.addListener(async () => createOrFocusPopupWindow())

chrome.tabs.onRemoved.addListener(async (tabId) => {
  await handleActiveConnection('disconnected', tabId)
})
