import { PairingState } from 'connector'
import { useEffect, useState } from 'react'
import { tap } from 'rxjs'
import { useConnector } from './use-connector'

export const usePairingState = () => {
  const [pairingState, setPairingState] = useState<PairingState>('loading')
  const connector = useConnector()

  useEffect(() => {
    if (!connector) return

    const subscription = connector.pairingState$
      .pipe(tap(setPairingState))
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [connector])

  return pairingState
}