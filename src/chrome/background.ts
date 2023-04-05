import { config } from 'config'
import { closePopup } from './helpers/close-popup'
// @ts-ignore
import content from './content?script'

import { createOffscreen } from './offscreen/create-offscreen'
import { getConnectionPassword } from './helpers/get-connection-password'
import { BackgroundMessageHandler } from './messages/background-messages'
import { sendMessage } from './helpers/send-message'
import { createMessage } from './messages/create-message'
import { MessageHandler } from './messages/message-handler'
import { openParingPopup } from './helpers/open-pairing-popup'

const handleConnectionPasswordChange = (connectionPassword?: string) =>
  sendMessage(createMessage.connectionPasswordChange(connectionPassword)).map(
    () => {
      setTimeout(() => {
        closePopup()
      }, config.popup.closeDelayTime)
    }
  )

const handleStorageChange = (changes: {
  [key: string]: chrome.storage.StorageChange
}) => {
  if (changes['connectionPassword'])
    return handleConnectionPasswordChange(
      changes['connectionPassword']?.newValue
    )
}

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

const messageHandler = MessageHandler({
  backgroundMessageHandler: BackgroundMessageHandler(),
})

chrome.runtime.onMessage.addListener((message, sender) => {
  messageHandler.onMessage(message, sender.tab?.id)
})
chrome.storage.onChanged.addListener(handleStorageChange)
chrome.action.onClicked.addListener(openParingPopup)
chrome.runtime.onInstalled.addListener(handleOnInstallExtension)

createOffscreen()

const bootstrapOffscreenPage = () =>
  getConnectionPassword()
    .andThen((connectionPassword) =>
      sendMessage(createMessage.connectionPasswordChange(connectionPassword))
    )
    .mapErr(() => {
      setTimeout(bootstrapOffscreenPage)
    })

bootstrapOffscreenPage()
