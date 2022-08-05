import { subjects } from 'connections'
import { useEffect, useState } from 'react'
import { tap } from 'rxjs'
import { toBuffer } from 'utils/to-buffer'

export const useWebRtcIncomingMessage = () => {
  const [message, setMessage] = useState<string>()

  useEffect(() => {
    const subscription = subjects.rtcIncomingMessageSubject
      .pipe(
        tap((message) => setMessage(toBuffer(message.data).toString('utf-8')))
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return message
}
