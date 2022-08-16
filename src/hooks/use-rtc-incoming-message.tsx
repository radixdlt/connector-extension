import { subjects } from 'connections'
import { useEffect, useState } from 'react'
import { tap } from 'rxjs'

export const useWebRtcIncomingMessage = () => {
  const [message, setMessage] = useState<string>()

  useEffect(() => {
    const subscription = subjects.rtcIncomingMessageSubject
      .pipe(tap((message) => setMessage(message)))
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return message
}
