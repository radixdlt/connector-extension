import { createChromeHandler } from 'trpc-chrome/adapter'
import { createOffscreen } from '../offscreen/create-offscreen'
import { BackgroundMessageHandler } from './message-handler'
import { createMessage } from '../messages/create-message'
import { MessageClient } from '../messages/message-client'
import { openParingPopup } from '../helpers/open-pairing-popup'
import { logger as utilsLogger } from 'utils/logger'
import { LedgerTabWatcher } from './ledger-tab-watcher'
import { onNotificationClicked } from './notification-dispatcher'
import { sendMessage } from 'chrome/messages/send-message'
import {
  isTabIdRequest,
  runtimeMessageListener,
} from 'chrome/messages/runtime-listener'
import { backgroundRouter } from './router/router'
import { createBackgroundRouterContext } from './router/context'
import { createContentScriptClient } from './router/clients/content-script'
import { hasConnections } from 'chrome/helpers/get-connections'
import { syncActionBehavior } from './sync-action-behavior'
import { getOpenSidePanelOnActionClick } from 'side-panel/action-behavior'
import { logServiceWorkerStart } from './service-worker-start'
import { onInstallExtension } from './install'
import { mirrorStorageToOffscreen } from './storage-mirror'
import { registerContextMenu } from './context-menu'

const logger = utilsLogger.getSubLogger({ name: 'background' })

const ledgerTabWatcher = LedgerTabWatcher()

const messageHandler = MessageClient(
  BackgroundMessageHandler({
    logger,
    ledgerTabWatcher: ledgerTabWatcher,
  }),
  'background',
  { logger },
)

const tabRemovedListener = (tabId: number) => {
  ledgerTabWatcher.triggerTabRemoval(tabId)
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  const isTabReload = changeInfo.status === 'loading' && !changeInfo.url
  if (isTabReload) {
    tabRemovedListener(tabId)
  }
})

chrome.runtime.onMessage.addListener((message, sender, response) => {
  if (isTabIdRequest(message)) response(sender.tab?.id)
})

chrome.runtime.onMessage.addListener(
  runtimeMessageListener(messageHandler, logger),
)

chrome.tabs.onRemoved.addListener(tabRemovedListener)
chrome.notifications.onClicked.addListener(onNotificationClicked)
chrome.notifications.onButtonClicked.addListener(onNotificationClicked)
mirrorStorageToOffscreen(messageHandler)
// Only without a popup. Chrome opens the side panel itself when the icon is set to
// open it (it then sends no click): never open a window on top of it.
chrome.action.onClicked.addListener(() => {
  getOpenSidePanelOnActionClick().map((openSidePanel) => {
    if (!openSidePanel) openParingPopup()
  })
})
syncActionBehavior({ logger })

chrome.runtime.onInstalled.addListener(onInstallExtension(logger))

chrome.runtime.onStartup.addListener(() => {
  logger.info('browser started with this profile')
})

registerContextMenu()

chrome.idle.onStateChanged.addListener((state) => {
  logger.debug('💻 onStateChanged:', state)
  if (state === 'active') {
    logger.info('the computer is active again: restarting idle wallet links')
    sendMessage(createMessage.restartConnector())
  }
})

// Logged once the offscreen document runs: it keeps the logs ("Export Logs").
createOffscreen(logger).finally(() => logServiceWorkerStart(logger))

createChromeHandler({
  router: backgroundRouter,
  createContext: createBackgroundRouterContext({
    contentScriptClient: createContentScriptClient({ logger }),
    openParingPopup,
    hasConnections,
    logger,
  }),
})
