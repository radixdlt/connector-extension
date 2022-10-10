import { WebRtcContext } from 'contexts/web-rtc-context'
import { useContext, useEffect } from 'react'

export const useConnect = (connect: boolean) => {
  const webRtc = useContext(WebRtcContext)

  useEffect(() => {
    if (!webRtc) return
    webRtc.signaling.subjects.wsConnectSubject.next(connect)
  }, [webRtc, connect])
}
