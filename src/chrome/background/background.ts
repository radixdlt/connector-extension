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
    return handleConnectionPasswordChange(
      changes['connectionPassword']?.newValue
    )
}

const messageHandler = MessageClient(
  BackgroundMessageHandler({ logger: backgroundLogger }),
  'background',
  {}
)

const handleConnectionPasswordChange = (connectionPassword?: string) =>
  messageHandler
    .sendMessageAndWaitForConfirmation(
      createMessage.setConnectionPassword('background', connectionPassword)
    )
    .map(() => {
      setTimeout(() => {
        closePopup()
      }, config.popup.closeDelayTime)
    })

chrome.runtime.onMessage.addListener((message, sender) => {
  messageHandler.onMessage(message, sender.tab?.id)
})
chrome.storage.onChanged.addListener(handleStorageChange)
chrome.action.onClicked.addListener(openParingPopup)
chrome.runtime.onInstalled.addListener(handleOnInstallExtension)

createOffscreen()
