import { WebRtcContext } from 'contexts/web-rtc-context'
import { useContext, useEffect } from 'react'
import { filter, tap, withLatestFrom } from 'rxjs'

export const useSaveConnectionPassword = () => {
  const webRtc = useContext(WebRtcContext)
  useEffect(() => {
    if (!webRtc) return
    const subscription = webRtc.webRtcClient.subjects.rtcStatusSubject
      .pipe(
        filter((status) => status === 'connected'),
        withLatestFrom(webRtc.webRtcClient.subjects.wsConnectionSecretsSubject),
        tap(([, secretsResult]) =>
          secretsResult?.map((secrets) =>
            webRtc.storageClient.subjects.addConnectionPasswordSubject.next(
              secrets.encryptionKey
            )
          )
        )
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])
}
