import { Text } from 'components'
import { WebRtcContext } from 'contexts/web-rtc-context'
import { useContext, useEffect, useState } from 'react'
import { Subscription } from 'rxjs'
import { Status } from 'signaling/subjects'

export const SignalingServer = () => {
  const webRtc = useContext(WebRtcContext)
  const [status, setStatus] = useState<Status>()

  useEffect(() => {
    if (!webRtc) return

    webRtc?.signaling.subjects.wsConnectSubject.next(true)

    const subscription = new Subscription()

    subscription.add(
      webRtc.signaling.subjects.wsStatusSubject.subscribe((status) => {
        setStatus(status)
      })
    )

    subscription.add(
      webRtc?.signaling.subjects.wsIncomingRawMessageSubject.subscribe(
        (raw) => {
          const message = JSON.parse(raw.data)
          if (
            [
              'remoteClientJustConnected',
              'remoteClientIsAlreadyConnected',
            ].includes(message.info)
          ) {
            webRtc?.webRtc.subjects.rtcCreateOfferSubject.next()
          }
        }
      )
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [webRtc])

  return (
    <Text>
      📡 Signaling server:{' '}
      {status === 'connected' ? `🟢` : status === 'disconnected' ? '🔴' : '⚪️'}
    </Text>
  )
}
