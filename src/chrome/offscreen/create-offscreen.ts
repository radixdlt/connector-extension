import { config } from 'config'
import { hasOffscreen } from 'utils/browser-detect'

const MAX_RETRIES = 3
let creating: Promise<void> | null
let retryCount = 0

export async function createOffscreen() {
  if (!hasOffscreen()) {
    console.warn('chrome.offscreen is not available; offscreen document will not be created')
    return
  }

  const offscreenUrl = chrome.runtime.getURL(config.offscreen.url)

  // @ts-ignore: clients exists in service workers context
  const matchedClients = await clients.matchAll()

  for (const client of matchedClients) {
    if (client.url === offscreenUrl) {
      return
    }
  }

  if (await chrome.offscreen.hasDocument()) {
    return
  }

  if (creating) {
    await creating
  } else {
    try {
      creating = chrome.offscreen.createDocument({
        url: offscreenUrl,
        reasons: [chrome.offscreen.Reason.WEB_RTC],
        justification: 'Keep WebRTC connection with mobile wallet',
      })

      await creating
      creating = null
      retryCount = 0
    } catch (error) {
      creating = null
      retryCount++
      if (retryCount <= MAX_RETRIES) {
        return createOffscreen()
      }
      console.error('Failed to create offscreen document after retries:', error)
    }
  }
}
