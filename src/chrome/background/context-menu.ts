import { isDevMode } from 'config'
import { createMessage } from '../messages/create-message'
import { sendMessage } from 'chrome/messages/send-message'
import { openRadixDevToolsPage } from './open-radix-dev-tools-page'

/** The icon's menu: "Export Logs", and the dev tools in development builds. */
export const registerContextMenu = () => {
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
}
