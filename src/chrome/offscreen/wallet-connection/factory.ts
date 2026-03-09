import { AppLogger } from 'utils/logger'
import { WalletConnectionClient } from './wallet-connection-client'
import { config, getConnectionConfig } from 'config'
import { MessagesRouter } from 'chrome/offscreen/wallet-connection/messages-router'
import { ConnectorClient } from '@radixdlt/radix-connect-webrtc'
import { syncClient } from './sync-client'
import { Connection } from 'pairing/state/connections'
import { SessionRouter } from '../session-router'
import type { ConnectorExtensionOptions } from 'options'

export type walletConnectionClientFactory = typeof walletConnectionClientFactory

export const sessionRouter = SessionRouter()

export const walletConnectionClientFactory = (input: {
  connection: Connection
  logger: AppLogger
  radixConnectConfiguration?: string
  connectorExtensionOptions?: ConnectorExtensionOptions
  connectorClient?: ConnectorClient
  messagesRouter?: MessagesRouter
}): WalletConnectionClient => {
  const messagesRouter = input.messagesRouter || MessagesRouter()

  const logger = input.logger.getSubLogger({
    name: `[WCC]:[${input.connection.walletName}]`,
  })

  const connectorClient =
    input.connectorClient ||
    ConnectorClient({
      source: 'extension',
      target: 'wallet',
      isInitiator: config.webRTC.isInitiator,
      logger,
      negotiationTimeout: 10_000,
    })

  const client = WalletConnectionClient({
    messagesRouter,
    connectorClient,
    syncClient,
    connectionPassword: input.connection.password,
    walletPublicKey: input.connection.walletPublicKey,
    sessionRouter,
    logger,
  })

  if (input.connectorExtensionOptions) {
    client.setConnectionConfig(
      getConnectionConfig(input.connectorExtensionOptions),
    )
  } else if (input.radixConnectConfiguration) {
    client.setConnectionConfig(
      getConnectionConfig({
        radixConnectConfiguration: input.radixConnectConfiguration,
      } as ConnectorExtensionOptions),
    )
  }
  return client
}
