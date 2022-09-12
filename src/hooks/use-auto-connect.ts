import { WebRtcContext } from 'contexts/web-rtc-context'
import { useContext, useEffect, useState } from 'react'
import { tap } from 'rxjs'

export const useAutoConnect = () => {
  const [autoConnect, setAutoConnect] = useState<boolean>(false)
  const webRtc = useContext(WebRtcContext)

  useEffect(() => {
    if (!webRtc) return
    const subscription = webRtc?.signaling.subjects.wsAutoConnect
      .pipe(tap((result) => setAutoConnect(result)))
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return autoConnect
}
