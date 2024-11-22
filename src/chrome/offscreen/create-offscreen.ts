import { config } from 'config'

let creating: Promise<void> | null

export async function createOffscreen() {
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
    } catch (error) {
      creating = null
      return createOffscreen()
    }
  }
}
