import { createMessage } from 'chrome/messages/create-message'
import { MessageClient } from 'chrome/messages/message-client'
import { ConnectorExtensionOptions } from 'options'
import { SessionId, WalletPublicKey } from '../session-router'
import { Connections } from 'pairing/state/connections'

export const initialize = (messageClient: MessageClient) => {
  return {
    options: () => {
      messageClient
        .sendMessageAndWaitForConfirmation<{
          options: ConnectorExtensionOptions
        }>(createMessage.getExtensionOptions('offScreen'))
        .andThen(({ options }) =>
          messageClient.handleMessage(
            createMessage.setConnectorExtensionOptions('offScreen', options),
          ),
        )
    },
    sessionRouterData: () => {
      messageClient
        .sendMessageAndWaitForConfirmation<{
          sessionRouter: Record<SessionId, WalletPublicKey>
        }>(createMessage.getSessionRouterData())
        .andThen(({ sessionRouter }) =>
          messageClient.handleMessage(
            createMessage.setSessionRouterData(sessionRouter, 'offScreen'),
          ),
        )
    },
    connections: () => {
      messageClient
        .sendMessageAndWaitForConfirmation<Connections>(
          createMessage.getConnections('offScreen'),
        )
        .andThen((connections) =>
          messageClient.handleMessage(
            createMessage.setConnections('offScreen', connections),
          ),
        )
    },
  }
}
