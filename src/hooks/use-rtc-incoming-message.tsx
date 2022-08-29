import { WebRtcContext } from 'contexts/web-rtc-context'
import { useEffect, useState, useContext } from 'react'
import { tap } from 'rxjs'

export const useWebRtcIncomingMessage = () => {
  const webRtc = useContext(WebRtcContext)
  const [message, setMessage] = useState<string>()

  useEffect(() => {
    if (!webRtc) return
    const subscription = webRtc.webRtcClient.subjects.rtcIncomingMessageSubject
      .pipe(tap((message) => setMessage(message)))
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return message
}
