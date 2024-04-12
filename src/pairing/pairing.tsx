import { ConnectionPassword } from './components/connection-password'
import { useEffect, useState } from 'react'
import { ConnectorClient } from '@radixdlt/radix-connect-webrtc'
import { logger } from 'utils/logger'
import { config, radixConnectConfig } from 'config'
import { useConnectionsClient } from './state/connections'
import { useConnectorOptions } from './state/options'
import { Subscription, combineLatest, filter, map, switchMap, tap } from 'rxjs'
import { useNavigate } from 'react-router-dom'
import { ed25519 } from '@noble/curves/ed25519'
import { getLinkingSignatureMessage } from 'crypto/get-linking-message'

export const Pairing = () => {
  const [connectionPassword, setConnectionPassword] = useState<
    string | undefined
  >()
  const connectionsClient = useConnectionsClient()
  const connectorOptions = useConnectorOptions()
  const navigate = useNavigate()
  const [publicKey, setPublicKey] = useState<string>()
  const [signature, setSignature] = useState<string>()
  useEffect(() => {
    if (!connectorOptions) return

    setPublicKey(connectorOptions.publicKey)

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

    const hexConnectionPassword$ = connectorClient.connectionPassword$.pipe(
      filter(Boolean),
      tap((passwordBuffer) => {
        const message = getLinkingSignatureMessage(passwordBuffer)
        setSignature(
          Buffer.from(
            ed25519.sign(message, connectorOptions.privateKey),
          ).toString('hex'),
        )
      }),
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
          switchMap(() =>
            combineLatest([hexConnectionPassword$, linkClientInteraction$]),
          ),
        )
        .subscribe(([password, interaction]) => {
          connectionsClient
            .addOrUpdate(password, interaction)
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

  return (
    <>
      <ConnectionPassword
        connectionPassword={connectionPassword}
        purpose="general"
        publicKey={publicKey}
        signature={signature}
      />
    </>
  )
}
