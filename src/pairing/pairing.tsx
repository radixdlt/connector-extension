import { transportSlots } from 'chrome/offscreen/wallet-connection/transport/transport-slots'
import { ConnectionPassword } from './components/connection-password'
import { useEffect, useRef, useState } from 'react'
import { logger } from 'utils/logger'
import { config, getTransportConfig } from 'config'
import { useConnectionsClient } from './state/connections'
import { useConnectorOptions } from './state/options'
import {
  Subscription,
  combineLatest,
  exhaustMap,
  filter,
  map,
  switchMap,
  tap,
} from 'rxjs'
import { useNavigate } from 'react-router-dom'
import { ed25519 } from '@noble/curves/ed25519'
import { getLinkingSignatureMessage } from 'crypto/get-linking-message'
import { localStore } from 'chrome/helpers/storage'
import type { LinkClientInteraction } from 'ledger/schemas'
import { createWebRtcTransport } from 'chrome/offscreen/wallet-connection/transport/webrtc-transport'
import { IrohTransport } from 'chrome/offscreen/wallet-connection/transport/iroh/iroh-transport'
import { CompositeTransport } from 'chrome/offscreen/wallet-connection/transport/composite-transport'

export const Pairing = () => {
  const [connectionPassword, setConnectionPassword] = useState<
    string | undefined
  >()
  const connectionsClient = useConnectionsClient()
  const connectorOptions = useConnectorOptions()
  const navigate = useNavigate()
  const [publicKey, setPublicKey] = useState<string>()
  const [signature, setSignature] = useState<string>()

  // The connections client changes whenever the stored connections do. Read the
  // latest one when a wallet links instead of restarting the pairing for it: a
  // restart draws a new password, so a QR code the wallet already scanned would
  // stop matching the transports listening for it.
  const connectionsClientRef = useRef(connectionsClient)
  connectionsClientRef.current = connectionsClient

  // Restart the pairing only when what it depends on changes, not on every update
  // of the stored options object.
  const pairingKey = connectorOptions
    ? JSON.stringify([
        connectorOptions.publicKey,
        connectorOptions.privateKey,
        getTransportConfig(connectorOptions),
      ])
    : undefined

  useEffect(() => {
    if (!connectorOptions) return

    setPublicKey(connectorOptions.publicKey)

    const pairingLogger = logger.getSubLogger({ name: 'pairing' })

    // The WebRTC transport, which also generates the connection password.
    const connectorClient = createWebRtcTransport(pairingLogger)

    // The wallet may answer through any transport selected in the options.
    const transport = CompositeTransport({
      slots: transportSlots({
        webRtc: connectorClient,
        createIrohTransport: () =>
          IrohTransport({
            logger: pairingLogger.getSubLogger({ name: 'iroh' }),
          }),
      }),
      logger: pairingLogger,
    })

    transport.setConnectionConfig(getTransportConfig(connectorOptions))

    connectorClient
      .generateConnectionPassword()
      .andThen((buffer) => transport.setConnectionPassword(buffer))

    const subscription = new Subscription()

    const linkClientInteraction$ = transport.onMessage$.pipe(
      filter(
        (message): message is LinkClientInteraction =>
          message.discriminator === 'linkClient',
      ),
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
      transport.connected$
        .pipe(
          filter(Boolean),
          switchMap(() =>
            combineLatest([hexConnectionPassword$, linkClientInteraction$]),
          ),
          // One linking at a time, even if the wallet answers on both transports.
          exhaustMap(([password, interaction]) =>
            // Once the connection is stored, the offscreen document starts its own
            // iroh endpoint for the same password, and two endpoints must not share
            // a key: close this page's first. The wallet closes its iroh linking
            // connection once its linkClient is confirmed, so wait for that (bounded)
            // rather than cut the confirmation off. Resolves at once without iroh.
            transport
              .releaseIroh(config.iroh.linkingGracePeriod)
              .andThen(() =>
                connectionsClientRef.current.addOrUpdate(password, interaction),
              )
              .map(({ isKnownConnection }) => {
                localStore.remove('connectionPassword')
                transport.disconnect()
                navigate({
                  pathname: '/',
                  search: `?newWallet=${interaction.publicKey}&isKnownConnection=${isKnownConnection}`,
                })
              })
              .mapErr((error) => {
                pairingLogger.error('Could not link the wallet', {
                  message: error.message,
                  cause: error.cause,
                })
                transport.connect()
              }),
          ),
        )
        .subscribe(),
    )

    transport.connect()

    return () => {
      transport.destroy()
      subscription.unsubscribe()
    }
    // `connectorOptions` is read only when `pairingKey` changes (see above).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setConnectionPassword, pairingKey])

  return (
    <ConnectionPassword
      connectionPassword={connectionPassword}
      purpose="general"
      publicKey={publicKey}
      signature={signature}
    />
  )
}
