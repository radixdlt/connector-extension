import { config } from 'config'
import { makeChromeApi } from 'storage/storage-client'

const getExtensionTabs = async () =>
  (await chrome.tabs.query({})).filter((tab) =>
    tab?.url?.includes(chrome.runtime.id)
  )

const chromeAPI = makeChromeApi(config.storage.key)

chrome.runtime.onMessage.addListener(
  async (message, sender: chrome.runtime.MessageSender, sendResponse) => {
    const extensionTabs = await getExtensionTabs()
    const isExtensionOpen = extensionTabs.length > 0

    chromeAPI.getConnectionPassword().map((password) => {
      if (password) return undefined

      if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage()
      } else {
        window.open(chrome.runtime.getURL('index.html'))
      }

      return undefined
    })

    sendResponse(true)
  }
)
