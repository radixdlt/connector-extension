import { WebRtcContext } from 'contexts/web-rtc-context'
import { useContext, useEffect, useState } from 'react'
import { tap } from 'rxjs'

export const usePairingState = () => {
  const [pairingState, setPairingState] = useState<
    'paired' | 'notPaired' | 'loading'
  >('loading')
  const webRtc = useContext(WebRtcContext)

  useEffect(() => {
    if (!webRtc) return

    const checkStoredPassword = () =>
      webRtc.storage
        .getConnectionPassword()
        .map((password) => setPairingState(password ? 'paired' : 'notPaired'))

    checkStoredPassword()

    const subscription = webRtc.storage.subjects.onPasswordChange
      .pipe(tap(() => checkStoredPassword()))
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [webRtc])

  return pairingState
}
