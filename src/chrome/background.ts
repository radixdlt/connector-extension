import { config } from 'config'
import { getLogger } from 'loglevel'
import { makeChromeApi } from 'storage/storage-client'

const setupDevTools = () => {
  chrome.contextMenus.create({
    id: 'radix-dev-tools',
    title: 'Radix dev tools',
    contexts: ['all'],
  })

  chrome.contextMenus.onClicked.addListener(async () => {
    const devToolsUrl = chrome.runtime.getURL('src/chrome/dev-tools.html')
    const tabs = await chrome.tabs.query({})
    const devToolsTab = tabs.find((tab) => tab.url === devToolsUrl)

    if (devToolsTab?.id) {
      await chrome.tabs.update(devToolsTab.id, { active: true })
    } else {
      await chrome.tabs.create({
        url: devToolsUrl,
      })
    }
  })
}
if (config.devTools) setupDevTools()

const chromeAPI = makeChromeApi(config.storage.key, getLogger('background'))

chrome.runtime.onMessage.addListener((_, __, sendResponse) => {
  chromeAPI.getConnectionPassword().map((password) => {
    if (password) return undefined
    sendResponse(true)
    return chrome.runtime.openOptionsPage()
  })
})
