import { Bootstrap } from 'bootstrap/bootstrap'

const application = Bootstrap({
  logLevel: 'debug',
  signalingLogLevel: 'info',
  webRtcLoglevel: 'info',
})

window.addEventListener('radix#chromeExtension#send', (event) => {
  application.storage.getConnectionPassword().map((connectionPassword) => {
    const { detail: message } = event as CustomEvent<any>
    if (connectionPassword)
      application.webRtc.subjects.rtcAddMessageToQueue.next(message)

    chrome.runtime.sendMessage({})

    return undefined
  })
})
