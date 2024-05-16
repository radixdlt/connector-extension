import { LogsClient } from './logs-client'
import { errAsync, okAsync } from 'neverthrow'
import { AppLogger, logger as appLogger } from 'utils/logger'
import {
  Message,
  messageDiscriminator,
  MessageHandler,
  MessageHandlerOutput,
} from '../messages/_types'
import { WalletConnectionClient } from './wallet-connection/wallet-connection-client'
import { radixConnectConfig } from 'config'
import { Connections } from 'pairing/state/connections'
import {
  sessionRouter,
  type walletConnectionClientFactory,
} from './wallet-connection/factory'

export type OffscreenMessageHandler = ReturnType<typeof OffscreenMessageHandler>
export const OffscreenMessageHandler = (input: {
  logsClient: LogsClient
  connectionsMap: Map<string, WalletConnectionClient>
  walletConnectionClientFactory: walletConnectionClientFactory
  logger?: AppLogger
}): MessageHandler => {
  let radixConnectConfiguration: string
  const logsClient = input.logsClient
  const logger = input.logger
  const connectionsMap = input.connectionsMap

  return (message: Message): MessageHandlerOutput => {
    switch (message?.discriminator) {
      case messageDiscriminator.setConnections: {
        const { connections } = message as { connections: Connections }
        Object.entries(connections).forEach(([id, connection]) => {
          if (connectionsMap.has(id)) {
            const connectionClient = connectionsMap.get(
              id,
            ) as WalletConnectionClient
            connectionClient.update(connection)
          } else {
            logger?.debug(
              'Creating WalletConnectionClient',
              connection.walletName,
              connection.walletPublicKey,
            )

            connectionsMap.set(
              id,
              input.walletConnectionClientFactory({
                connection,
                logger: input.logger || appLogger,
                radixConnectConfiguration,
              }),
            )
          }
        })

        // Destroy & remove "WalletConnectionClient"s which do not have corresponding entry in connections configuration
        // This happens when user clicks "forget wallet"
        Array.from(connectionsMap.entries()).forEach(([id, connection]) => {
          if (!connections[id]) {
            connection.destroy()
            connectionsMap.delete(id)
          }
        })

        return okAsync({ sendConfirmation: true })
      }

      case messageDiscriminator.restartConnector: {
        for (const [, connection] of connectionsMap) {
          connection.connectorClient.restart()
        }
        return okAsync({ sendConfirmation: true })
      }

      case messageDiscriminator.setRadixConnectConfiguration: {
        const { connectorExtensionOptions } = message
        radixConnectConfiguration =
          connectorExtensionOptions.radixConnectConfiguration

        for (const [, connection] of connectionsMap) {
          connection.setConnectionConfig(
            radixConnectConfig[
              connectorExtensionOptions.radixConnectConfiguration
            ],
          )
        }

        return okAsync({ sendConfirmation: true })
      }

      case messageDiscriminator.setSessionRouterData: {
        const { data } = message
        sessionRouter.refreshStore(data)
        logger?.info('setSessionRouterData', data)
        return okAsync({ sendConfirmation: true })
      }

      case messageDiscriminator.downloadLogs: {
        logsClient.download()
        return okAsync({ sendConfirmation: false })
      }

      case messageDiscriminator.log: {
        logsClient.add(message.log)
        return okAsync({ sendConfirmation: false })
      }

      default:
        return errAsync({
          reason: 'unhandledMessageDiscriminator',
        })
    }
  }
}
