import { AppLogger } from 'utils/logger'
import { WalletConnectionClient } from './wallet-connection-client'
import { config, radixConnectConfig } from 'config'
import { MessagesRouter } from 'chrome/offscreen/wallet-connection/messages-router'
import { ConnectorClient } from '@radixdlt/radix-connect-webrtc'
import { syncClient } from './sync-client'
import { Connection } from 'pairing/state/connections'
import { SessionRouter } from '../session-router'

export type walletConnectionClientFactory = typeof walletConnectionClientFactory

export const sessionRouter = SessionRouter()

export const walletConnectionClientFactory = (input: {
  connection: Connection
  logger: AppLogger
  radixConnectConfiguration?: string
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
    })

  const client = WalletConnectionClient({
    messagesRouter,
    connectorClient,
    syncClient,
    connectionPassword: input.connection.password,
    clientId: input.connection.clientId,
    sessionRouter,
    logger,
  })

  if (input.radixConnectConfiguration) {
    client.setConnectionConfig(
      radixConnectConfig[input.radixConnectConfiguration],
    )
  }
  return client
}
