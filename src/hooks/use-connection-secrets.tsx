import { WebRtcContext } from 'contexts/web-rtc-context'
import { Result } from 'neverthrow'
import { useContext, useEffect, useState } from 'react'
import { tap } from 'rxjs'
import { Secrets } from 'signaling/secrets'

export const useConnectionSecrets = () => {
  const webRtc = useContext(WebRtcContext)
  const [secrets, setSecrets] = useState<Result<Secrets, Error> | undefined>(
    undefined
  )

  useEffect(() => {
    if (!webRtc) return
    const subscription = webRtc.signaling.subjects.wsConnectionSecretsSubject
      .pipe(tap((result) => setSecrets(result)))
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return secrets
}
