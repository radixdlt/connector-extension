import { subjects } from 'connections'
import { useEffect, useState } from 'react'
import { tap } from 'rxjs'

export const useAutoConnect = () => {
  const [autoConnect, setAutoConnect] = useState<boolean>(false)

  useEffect(() => {
    const subscription = subjects.wsAutoConnect
      .pipe(tap((result) => setAutoConnect(result)))
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return autoConnect
}
