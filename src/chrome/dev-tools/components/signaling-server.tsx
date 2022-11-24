import { Text } from 'components'
import { useConnector } from 'hooks/use-connector'
import { useEffect, useState } from 'react'
import { Subscription } from 'rxjs'
import { Status } from '../../../connector'

export const SignalingServer = () => {
  const connector = useConnector()
  const [status, setStatus] = useState<Status>()

  useEffect(() => {
    if (!connector) return

    connector?.signalingServerClient.subjects.wsConnectSubject.next(true)

    const subscription = new Subscription()

    subscription.add(
      connector.signalingServerClient.subjects.wsStatusSubject.subscribe(
        (status) => {
          setStatus(status)
        }
      )
    )

    subscription.add(
      connector?.signalingServerClient.subjects.wsIncomingRawMessageSubject.subscribe(
        (raw) => {
          const message = JSON.parse(raw.data)
          if (
            [
              'remoteClientJustConnected',
              'remoteClientIsAlreadyConnected',
            ].includes(message.info)
          ) {
            connector?.webRtcClient.subjects.rtcCreateOfferSubject.next()
          }
        }
      )
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [connector])

  return (
    <Text>
      📡 Signaling server:{' '}
      {status === 'connected' ? `🟢` : status === 'disconnected' ? '🔴' : '⚪️'}
    </Text>
  )
}
