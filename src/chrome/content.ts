import { Bootstrap } from 'bootstrap/bootstrap'
import { Subscription, switchMap } from 'rxjs'
import { parseJSON } from 'utils'

const application = Bootstrap({ logLevel: 'debug' })

let subscriptions: Subscription

const createSubscriptions = () => {
  const subscription = new Subscription()
  subscription.add(
    application.webRtc.subjects.rtcStatusSubject
      .pipe(
        switchMap((status) =>
          chrome.runtime.sendMessage({ connectionStatus: status })
        )
      )
      .subscribe()
  )
  return subscription
}

window.addEventListener('radix#chromeExtension#send', (event) => {
  const { detail: message } = event as CustomEvent<any>
  application.webRtc.subjects.rtcAddMessageToQueue.next(message)
  chrome.runtime.sendMessage({})
  if (!subscriptions) subscriptions = createSubscriptions()
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
