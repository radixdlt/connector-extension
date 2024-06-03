import { createMessage } from 'chrome/messages/create-message'
import { MessageClient } from 'chrome/messages/message-client'
import { ConnectorExtensionOptions } from 'options'
import { SessionId, WalletPublicKey } from '../session-router'
import { Connections } from 'pairing/state/connections'

/**
 * This section of code handles the retrieval of important data from the background page
 * in order to provide necessary information to the offscreen page.
 *
 * The offscreen page does not have direct access to chrome.storage, so it relies on sending messages
 * to the background page to obtain the following data:
 *  - Connector Extension Options
 *  - Session Router Data
 *  - Wallet Connections
 *
 * Each function within this code block is responsible for retrieving one specific key from the chrome storage.
 */
export const OffscreenInitializationMessages = (
  messageClient: MessageClient,
) => {
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
        .sendMessageAndWaitForConfirmation<Record<SessionId, WalletPublicKey>>(
          createMessage.getSessionRouterData(),
        )
        .andThen((sessionRouter) =>
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
