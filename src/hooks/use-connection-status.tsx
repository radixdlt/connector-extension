import { useEffect, useState } from 'react'
import { tap } from 'rxjs'
import { Status } from 'connector'
import { useConnector } from './use-connector'

export const useConnectionStatus = () => {
  const connector = useConnector()
  const [status, setStatus] = useState<Status>()

  useEffect(() => {
    if (!connector) return
    const subscription = connector.connectionStatus$
      .pipe(tap((result) => setStatus(result)))
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [connector])

  return status
}
