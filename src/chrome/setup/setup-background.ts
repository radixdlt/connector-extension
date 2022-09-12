import { config } from 'config'
import { getLogger } from 'loglevel'
import { makeChromeApi } from 'storage/storage-client'

const chromeAPI = makeChromeApi(config.storage.key, getLogger('background'))

chrome.runtime.onMessage.addListener((_, __, sendResponse) => {
  chromeAPI.getConnectionPassword().map((password) => {
    if (password) return undefined
    sendResponse(true)
    return chrome.runtime.openOptionsPage()
  })
})
