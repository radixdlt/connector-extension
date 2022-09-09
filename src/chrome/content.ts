import { Bootstrap } from 'bootstrap/bootstrap'
import { parseJSON } from 'utils'

const application = Bootstrap({
  logLevel: 'debug',
  signalingLogLevel: 'debug',
  webRtcLoglevel: 'debug',
  storageLogLevel: 'debug',
})

window.addEventListener('radix#chromeExtension#send', (event) => {
  const { detail: message } = event as CustomEvent<any>
  application.webRtc.subjects.rtcAddMessageToQueue.next(message)
  chrome.runtime.sendMessage({})
})

application.webRtc.subjects.rtcIncomingMessageSubject.subscribe((raw) => {
  parseJSON(raw).map((message) =>
    window.dispatchEvent(
      new CustomEvent('radix#chromeExtension#receive', {
        detail: message,
      })
    )
  )
})
