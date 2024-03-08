import { ConnectionPassword } from './components/connection-password'
import { useEffect, useState } from 'react'
import { ConnectorClient } from '@radixdlt/radix-connect-webrtc'
import { logger } from 'utils/logger'
import { config, radixConnectConfig } from 'config'
import { useConnectionsClient } from './state/connections'
import { useConnectorOptions } from './state/options'
import { Subscription, filter, map, tap, withLatestFrom } from 'rxjs'
import { useNavigate } from 'react-router-dom'

export const Pairing = () => {
  const [connectionPassword, setConnectionPassword] = useState<
    string | undefined
  >()
  const connectionsClient = useConnectionsClient()
  const connectorOptions = useConnectorOptions()
  const navigate = useNavigate()

  useEffect(() => {
    if (!connectorOptions) return

    const connectorClient = ConnectorClient({
      source: 'extension',
      target: 'wallet',
      isInitiator: config.webRTC.isInitiator,
      logger: logger.getSubLogger({ name: 'pairing' }),
      negotiationTimeout: 10_000,
    })

    connectorClient.setConnectionConfig(
      radixConnectConfig[connectorOptions.radixConnectConfiguration],
    )

    connectorClient
      .generateConnectionPassword()
      .andThen((buffer) => connectorClient.setConnectionPassword(buffer))

    const subscription = new Subscription()

    const linkClientInteraction$ = connectorClient.onMessage$.pipe(
      filter((message) => message.discriminator === 'linkClient'),
    )

    const sendLinkClientInteraction = connectorClient.sendMessage({
      discriminator: 'linkClient',
      clientId: connectorOptions.clientId,
      purpose: 'general',
    })

    const hexConnectionPassword$ = connectorClient.connectionPassword$.pipe(
      filter(Boolean),
      map((buffer) => buffer.toString('hex')),
    )

    subscription.add(
      hexConnectionPassword$.subscribe((password) => {
        setConnectionPassword(password)
      }),
    )

    subscription.add(
      connectorClient.connected$
        .pipe(
          filter(Boolean),
          tap(() => {}),
          withLatestFrom(hexConnectionPassword$),
        )
        .subscribe(([, password]) => {
          connectionsClient
            .addOrUpdate(password, crypto.randomUUID())
            .map(() => connectorClient.disconnect())
            .map(() => navigate('/'))
        }),
    )

    connectorClient.connect()

    return () => {
      connectorClient.destroy()
      subscription.unsubscribe()
    }
  }, [setConnectionPassword, connectorOptions, connectionsClient])

  return <ConnectionPassword connectionPassword={connectionPassword} />
}
