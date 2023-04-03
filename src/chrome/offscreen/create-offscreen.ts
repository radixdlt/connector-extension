import { config } from 'config'

export const createOffscreen = async () => {
  if (await chrome.offscreen.hasDocument()) {
    return
  }
  await chrome.offscreen.createDocument({
    url: config.offscreen.url,
    reasons: [chrome.offscreen.Reason.WEB_RTC],
    justification: 'Keep WebRTC connection with mobile wallet',
  })
}
