import { DataChannelStatus, subjects } from 'connections'
import { useEffect, useState } from 'react'
import { tap } from 'rxjs'

export const useWebRtcDataChannelStatus = () => {
  const [secrets, setSecrets] = useState<DataChannelStatus>()

  useEffect(() => {
    const subscription = subjects.rtcStatusSubject
      .pipe(tap((result) => setSecrets(result)))
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return secrets
}
