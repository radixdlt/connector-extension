import { AppLogger } from 'utils/logger'
import { WalletConnectionClient } from './wallet-connection-client'
import { config, radixConnectConfig } from 'config'
import { MessagesRouter } from 'chrome/offscreen/wallet-connection/messages-router'
import { ConnectorClient } from '@radixdlt/radix-connect-webrtc'
import { syncClient } from './sync-client'

export type walletConnectionClientFactory = typeof walletConnectionClientFactory

export const walletConnectionClientFactory = (input: {
  walletName: string
  connectionPassword: string
  logger: AppLogger
  radixConnectConfiguration?: string
  connectorClient?: ConnectorClient
  messagesRouter?: MessagesRouter
}): WalletConnectionClient => {
  const messagesRouter = input.messagesRouter || MessagesRouter()

  const logger = input.logger.getSubLogger({
    name: `[WCC]:[${input.walletName}]`,
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
    connectionPassword: input.connectionPassword,
    logger,
  })

  if (input.radixConnectConfiguration) {
    client.setConnectionConfig(
      radixConnectConfig[input.radixConnectConfiguration],
    )
  }
  return client
}
