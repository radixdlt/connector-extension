import { config, isDevMode } from 'config'
import { closePopup } from '../helpers/close-popup'
import { createChromeHandler } from 'trpc-chrome/adapter'
// @ts-ignore
import content from '../content-script/content-script?script'

import { createOffscreen } from '../offscreen/create-offscreen'
import { BackgroundMessageHandler } from './message-handler'
import { createMessage } from '../messages/create-message'
import { MessageClient } from '../messages/message-client'
import { openParingPopup } from '../helpers/open-pairing-popup'
import { logger as utilsLogger } from 'utils/logger'
import { LedgerTabWatcher } from './ledger-tab-watcher'
import {
  txNotificationPrefix,
  txNotificationSplitter,
} from './notification-dispatcher'
import { createAndFocusTab } from 'chrome/helpers/create-and-focus-tab'
import { RadixNetworkConfigById } from '@radixdlt/babylon-gateway-api-sdk'
import { openRadixDevToolsPage } from './open-radix-dev-tools-page'
import { sendMessage } from 'chrome/messages/send-message'
import { Connections } from 'pairing/state/connections'
import { getExtensionOptions, setConnectorExtensionOptions } from 'options'
import { messageSource } from 'chrome/messages/_types'
import { backgroundRouter } from './router/router'
import { createBackgroundRouterContext } from './router/context'
import { createContentScriptClient } from './router/clients/content-script'
import { getOffscreenClient } from './router/clients/offscreen'
import { hasConnections } from 'chrome/helpers/get-connections'

const logger = utilsLogger.getSubLogger({ name: 'background' })

const handleOnInstallExtension = async () => {
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

  getExtensionOptions()
    .andThen(setConnectorExtensionOptions)
    .mapErr(() => logger.error('Failed to set extension options'))
}

const handleStorageChange = (
  changes: {
    [key: string]: chrome.storage.StorageChange
  },
  area: string,
) => {
  if (changes['connections'] && area === 'local') {
    handleConnectionsChange(changes['connections']?.newValue)
  }

  if (changes['options'] && area === 'local') {
    messageHandler.sendMessageAndWaitForConfirmation(
      createMessage.setConnectorExtensionOptions(
        'background',
        changes['options'].newValue,
      ),
    )
  }

  if (changes['sessionRouter'] && area === 'local') {
    messageHandler.sendMessageAndWaitForConfirmation(
      createMessage.setSessionRouterData(
        changes['sessionRouter'].newValue,
        messageSource.background,
      ),
    )
  }
}

const ledgerTabWatcher = LedgerTabWatcher()

const messageHandler = MessageClient(
  BackgroundMessageHandler({
    logger,
    ledgerTabWatcher: ledgerTabWatcher,
  }),
  'background',
  { logger },
)

const handleConnectionsChange = (connections?: Connections) =>
  messageHandler
    .sendMessageAndWaitForConfirmation(
      createMessage.setConnections('background', connections || {}),
    )
    .map(() => {
      setTimeout(() => {
        closePopup()
      }, config.popup.closeDelayTime)
    })

const handleNotificationClick = (notificationId: string) => {
  if (notificationId.startsWith(txNotificationPrefix)) {
    const [, networkId, txId] = notificationId.split(txNotificationSplitter)
    createAndFocusTab(
      `${
        RadixNetworkConfigById[Number(networkId)].dashboardUrl
      }/transaction/${txId}`,
    )
  }
}

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
  if (message.type === 'getTabId') response(sender.tab?.id)
})

chrome.runtime.onMessage.addListener((message, sender) => {
  messageHandler.onMessage(message, sender.tab?.id)
})

chrome.tabs.onRemoved.addListener(tabRemovedListener)
chrome.notifications.onClicked.addListener(handleNotificationClick)
chrome.notifications.onButtonClicked.addListener(handleNotificationClick)
chrome.storage.onChanged.addListener(handleStorageChange)
chrome.action.onClicked.addListener(openParingPopup)

chrome.runtime.onInstalled.addListener(handleOnInstallExtension)

chrome.runtime.onStartup.addListener(() => {
  logger.debug('onStartup')
})

chrome.contextMenus?.removeAll(() => {
  if (isDevMode) {
    chrome.contextMenus.create({
      id: 'radix-dev-tools',
      title: 'Radix Dev Tools',
      contexts: ['all'],
    })
  }

  chrome.contextMenus.create({
    id: 'radix-ce-logs',
    title: 'Export Logs',
    contexts: ['action'],
  })
})

chrome.contextMenus.onClicked.addListener((data) => {
  switch (data.menuItemId) {
    case 'radix-dev-tools':
      openRadixDevToolsPage()

      return
    case 'radix-ce-logs':
      sendMessage(createMessage.downloadLogs())
      return
  }
})

chrome.idle.onStateChanged.addListener((state) => {
  logger.debug('💻 onStateChanged:', state)
  if (state === 'active') sendMessage(createMessage.restartConnector())
})

createOffscreen()

createChromeHandler({
  router: backgroundRouter,
  createContext: createBackgroundRouterContext({
    contentScriptClient: createContentScriptClient({ logger }),
    getOffscreenClient,
    openParingPopup,
    hasConnections,
    logger,
  }),
})
