import { subjects } from 'connections'
import { Secrets } from 'connections/secrets'
import { Result } from 'neverthrow'
import { useEffect, useState } from 'react'
import { tap } from 'rxjs'

export const useConnectionSecrets = () => {
  const [secrets, setSecrets] = useState<Result<Secrets, Error> | undefined>(
    undefined
  )

  useEffect(() => {
    const subscription = subjects.wsConnectionSecretsSubject
      .pipe(tap((result) => setSecrets(result)))
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return secrets
}
