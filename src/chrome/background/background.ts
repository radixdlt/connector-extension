import { config } from 'config'
import { closePopup } from '../helpers/close-popup'
// @ts-ignore
import content from '../content-script/content-script?script'

import { createOffscreen } from '../offscreen/create-offscreen'
import { BackgroundMessageHandler } from './message-handler'
import { createMessage } from '../messages/create-message'
import { MessageClient } from '../messages/message-client'
import { openParingPopup } from '../helpers/open-pairing-popup'
import { AppLogger } from 'utils/logger'
import { LedgerTabWatcher } from './ledger-tab-watcher'
import {
  txNotificationPrefix,
  txNotificationSplitter,
} from './notification-dispatcher'
import { createAndFocusTab } from 'chrome/helpers/create-and-focus-tab'
import { RadixNetworkConfigById } from '@radixdlt/babylon-gateway-api-sdk'

const backgroundLogger = {
  debug: (...args: string[]) => console.log(JSON.stringify(args, null, 2)),
} as unknown as AppLogger

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
}

const handleStorageChange = (changes: {
  [key: string]: chrome.storage.StorageChange
}) => {
  if (changes['connectionPassword'])
    handleConnectionPasswordChange(changes['connectionPassword']?.newValue)

  if (changes['options']) {
    messageHandler.sendMessageAndWaitForConfirmation(
      createMessage.setConnectorExtensionOptions(
        'background',
        changes['options'].newValue,
      ),
    )
  }
}

const ledgerTabWatcher = LedgerTabWatcher()

const messageHandler = MessageClient(
  BackgroundMessageHandler({
    logger: backgroundLogger,
    ledgerTabWatcher: ledgerTabWatcher,
  }),
  'background',
  { logger: backgroundLogger },
)

const handleConnectionPasswordChange = (connectionPassword?: string) =>
  messageHandler
    .sendMessageAndWaitForConfirmation(
      createMessage.setConnectionPassword('background', connectionPassword),
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
  messageHandler.sendMessageAndWaitForConfirmation(
    createMessage.closeDappTab('background', tabId),
  )
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  const isTabReload = changeInfo.status === 'loading' && !changeInfo.url
  if (isTabReload) {
    tabRemovedListener(tabId)
  }
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
  backgroundLogger.debug('onStartup')
})

createOffscreen()
