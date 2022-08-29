import { Status } from 'connections'
import { WebRtcContext } from 'contexts/web-rtc-context'
import { useEffect, useState, useContext } from 'react'
import { tap } from 'rxjs'

export const useWebRtcDataChannelStatus = () => {
  const webRtc = useContext(WebRtcContext)
  const [secrets, setSecrets] = useState<Status>()

  useEffect(() => {
    if (!webRtc) return
    const subscription = webRtc.webRtcClient.subjects.rtcStatusSubject
      .pipe(tap((result) => setSecrets(result)))
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return secrets
}
