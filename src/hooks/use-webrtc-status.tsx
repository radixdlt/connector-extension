import { WebRtcContext } from 'contexts/web-rtc-context'
import { useEffect, useState, useContext } from 'react'
import { tap } from 'rxjs'
import { Status } from 'webrtc/subjects'

export const useWebRtcStatus = () => {
  const webRtc = useContext(WebRtcContext)
  const [status, setStatus] = useState<Status>()

  useEffect(() => {
    if (!webRtc) return
    const subscription = webRtc.webRtc.subjects.rtcStatusSubject
      .pipe(tap((result) => setStatus(result)))
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [webRtc])

  return status
}
