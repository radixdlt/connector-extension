import { WebRtcContext } from 'contexts/web-rtc-context'
import { useContext, useEffect } from 'react'
import { Buffer } from 'buffer'

type ConnectionSecretProps = {
  connectionPassword?: string
}

export const ConnectionSecret = ({
  connectionPassword,
}: ConnectionSecretProps) => {
  const webRtc = useContext(WebRtcContext)

  useEffect(() => {
    if (!webRtc || !connectionPassword) return

    webRtc?.signaling.subjects.wsConnectionPasswordSubject.next(
      Buffer.from(connectionPassword, 'hex')
    )
  }, [webRtc, connectionPassword])

  return null
}
