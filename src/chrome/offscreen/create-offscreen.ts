import { config } from 'config'

export const createOffscreen = async () => {
  if (await chrome.offscreen.hasDocument()) {
    return
  }

  setTimeout(async () => {
    await chrome.offscreen.createDocument({
      url: chrome.runtime.getURL(config.offscreen.url),
      reasons: [chrome.offscreen.Reason.WEB_RTC],
      justification: 'Keep WebRTC connection with mobile wallet',
    })
  }, 1000)
}
