import { WebRtcContext } from 'contexts/web-rtc-context'
import { useEffect, useState, useContext } from 'react'
import { tap } from 'rxjs'

export const useActiveConnections = () => {
  const webRtc = useContext(WebRtcContext)
  const [activeConnections, setActiveConnections] = useState<boolean>()

  useEffect(() => {
    if (!webRtc) return

    const subscription = webRtc.storage.subjects.activeConnections
      .pipe(tap((result) => setActiveConnections(result)))
      .subscribe()

    setActiveConnections(webRtc.storage.subjects.activeConnections.value)

    return () => {
      subscription.unsubscribe()
    }
  }, [webRtc])

  return !!activeConnections
}
