import { AppLogger } from 'utils/logger'
import {
  WalletConnectionClient,
  type WalletConnectionTransport,
} from './wallet-connection-client'
import { getTransportConfig } from 'config'
import { MessagesRouter } from 'chrome/offscreen/wallet-connection/messages-router'
import { syncClient } from './sync-client'
import { Connection } from 'pairing/state/connections'
import { SessionRouter } from '../session-router'
import type { ConnectorExtensionOptions } from 'options'
import { createWebRtcTransport } from './transport/webrtc-transport'
import { IrohTransport } from './transport/iroh/iroh-transport'
import { transportSlots } from 'chrome/offscreen/wallet-connection/transport/transport-slots'
import { CompositeTransport } from './transport/composite-transport'

export type walletConnectionClientFactory = typeof walletConnectionClientFactory

export const sessionRouter = SessionRouter()

export const walletConnectionClientFactory = (input: {
  connection: Connection
  logger: AppLogger
  radixConnectConfiguration?: string
  connectorExtensionOptions?: ConnectorExtensionOptions
  transport?: WalletConnectionTransport
  messagesRouter?: MessagesRouter
}): WalletConnectionClient => {
  const messagesRouter = input.messagesRouter || MessagesRouter()

  const logger = input.logger.getSubLogger({
    name: `[WCC]:[${input.connection.walletName}]`,
  })

  const transport =
    input.transport ||
    CompositeTransport({
      slots: transportSlots({
        webRtc: createWebRtcTransport(logger),
        createIrohTransport: () =>
          IrohTransport({ logger: logger.getSubLogger({ name: 'iroh' }) }),
      }),
      logger,
    })

  const client = WalletConnectionClient({
    messagesRouter,
    transport,
    syncClient,
    connectionPassword: input.connection.password,
    walletPublicKey: input.connection.walletPublicKey,
    sessionRouter,
    logger,
  })

  if (input.connectorExtensionOptions) {
    client.setConnectionConfig(
      getTransportConfig(input.connectorExtensionOptions),
    )
  } else if (input.radixConnectConfiguration) {
    client.setConnectionConfig(
      getTransportConfig({
        radixConnectConfiguration: input.radixConnectConfiguration,
      } as ConnectorExtensionOptions),
    )
  }
  return client
}
