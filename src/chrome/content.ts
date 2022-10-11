import { Bootstrap } from 'bootstrap/bootstrap'
import { switchMap } from 'rxjs'
import { parseJSON } from 'utils'

const application = Bootstrap({ logLevel: 'debug' })

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

application.webRtc.subjects.rtcStatusSubject
  .pipe(
    switchMap((status) =>
      chrome.runtime.sendMessage({ connectionStatus: status })
    )
  )
  .subscribe()
