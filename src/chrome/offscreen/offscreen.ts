import { AppLogger, logger as utilsLogger } from 'utils/logger'
import { MessagesRouter } from 'chrome/offscreen/wallet-connection/messages-router'
import { createMessage } from 'chrome/messages/create-message'
import { OffscreenMessageHandler } from 'chrome/offscreen/message-handler'
import { MessageClient } from 'chrome/messages/message-client'
import { Message } from 'chrome/messages/_types'
import { switchMap, timer } from 'rxjs'
import { ConnectorExtensionOptions } from 'options'
import { LogsClient } from './logs-client'
import { Connections } from 'pairing/state/connections'
import { WalletConnectionClient } from './wallet-connection/wallet-connection-client'
import { walletConnectionClientFactory } from './wallet-connection/factory'

const logsClient = LogsClient()

utilsLogger.attachTransport((logObj) => {
  logsClient.add(logObj)
})

const logger = utilsLogger.getSubLogger({ name: 'offScreen' })

const connections = new Map<string, WalletConnectionClient>()

const messageClient = MessageClient(
  OffscreenMessageHandler({
    connectionsMap: connections,
    logger,
    walletConnectionClientFactory,
    logsClient,
  }),
  'offScreen',
  { logger },
)

chrome.runtime.onMessage.addListener((message: Message, sender) => {
  messageClient.onMessage(message, sender.tab?.id)
})

messageClient
  .sendMessageAndWaitForConfirmation<{ options: ConnectorExtensionOptions }>(
    createMessage.getExtensionOptions('offScreen'),
  )
  .andThen(({ options }) =>
    messageClient.handleMessage(
      createMessage.setConnectorExtensionOptions('offScreen', options),
    ),
  )

const TWO_MINUTES = 120_000
const everyTwoMinute$ = timer(0, TWO_MINUTES)

everyTwoMinute$
  .pipe(
    switchMap(() =>
      messageClient
        .sendMessageAndWaitForConfirmation<Connections>(
          createMessage.getConnections('offScreen'),
        )
        .andThen((connections) =>
          messageClient.handleMessage(
            createMessage.setConnections('offScreen', connections),
          ),
        ),
    ),
  )
  .subscribe()

declare global {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface Window {
    radix: {
      messageClient: MessageClient
      connections: Map<string, WalletConnectionClient>
    }
  }
}

window.radix = {
  messageClient,
  connections,
}
