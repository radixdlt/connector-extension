import { WebRtcContext } from 'contexts/web-rtc-context'
import { useContext, useEffect } from 'react'
import { usePairingState } from './use-paring-state'

export const useGenerateConnectionPassword = () => {
  const webRtc = useContext(WebRtcContext)
  const paringState = usePairingState()

  useEffect(() => {
    if (!webRtc) return
    if (paringState === 'notPaired')
      webRtc.signaling.subjects.wsGenerateConnectionSecretsSubject.next()
  }, [webRtc, paringState])
}
