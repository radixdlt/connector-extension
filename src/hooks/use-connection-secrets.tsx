import { Result } from 'neverthrow'
import { useEffect, useState } from 'react'
import { tap } from 'rxjs'
import { Secrets } from 'connector'
import { useConnector } from './use-connector'

export const useConnectionSecrets = () => {
  const connector = useConnector()
  const [secrets, setSecrets] = useState<Result<Secrets, Error> | undefined>(
    undefined
  )

  useEffect(() => {
    if (!connector) return
    const subscription = connector.signaling.subjects.wsConnectionSecretsSubject
      .pipe(tap((result) => setSecrets(result)))
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [connector])

  return secrets
}
