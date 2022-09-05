import { Bootstrap } from 'bootstrap/bootstrap'

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
