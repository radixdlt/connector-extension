import { Text } from 'components'
import { WebRtcContext } from 'contexts/web-rtc-context'
import { useContext, useEffect, useState } from 'react'
import { Subscription } from 'rxjs'
import { Status } from 'signaling/subjects'

export const WebRtc = () => {
  const webRtc = useContext(WebRtcContext)
  const [status, setStatus] = useState<Status>()

  useEffect(() => {
    if (!webRtc) return

    const subscription = new Subscription()

    subscription.add(
      webRtc.webRtc.subjects.rtcStatusSubject.subscribe((status) => {
        setStatus(status)
      })
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [webRtc])

  return (
    <Text>
      🕸 Data channel:{' '}
      {status === 'connected' ? `🟢` : status === 'disconnected' ? '🔴' : '⚪️'}
    </Text>
  )
}
