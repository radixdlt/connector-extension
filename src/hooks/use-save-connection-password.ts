import { subjects as connectionSubjects } from 'connections/subjects'
import { useEffect } from 'react'
import { filter, tap, withLatestFrom } from 'rxjs'
import { storageSubjects } from 'storage/subjects'

export const useSaveConnectionPassword = () => {
  useEffect(() => {
    const subscription = connectionSubjects.rtcStatusSubject
      .pipe(
        filter((status) => status === 'connected'),
        withLatestFrom(connectionSubjects.wsConnectionSecretsSubject),
        tap(([, secretsResult]) =>
          secretsResult?.map((secrets) =>
            storageSubjects.addConnectionPasswordSubject.next(
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
