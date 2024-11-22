import { logger as utilsLogger } from 'utils/logger'
import { OffscreenMessageHandler } from 'chrome/offscreen/message-handler'
import { MessageClient } from 'chrome/messages/message-client'
import { Message } from 'chrome/messages/_types'
import { LogsClient } from './logs-client'
import { WalletConnectionClient } from './wallet-connection/wallet-connection-client'
import { walletConnectionClientFactory } from './wallet-connection/factory'
import { OffscreenInitializationMessages } from './helpers/offscreen-initialization-messages'
import { createChromeHandler } from 'trpc-chrome/adapter'
import { offscreenRouter } from './router/router'
import { backgroundClient } from './router/clients/background'

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

const messages = OffscreenInitializationMessages(messageClient)

messages.options()
messages.sessionRouterData()
messages.connections()

declare global {
  interface Window {
    radix: {
      messageClient: MessageClient
      connections: Map<string, WalletConnectionClient>
      backgroundClient: typeof backgroundClient
    }
  }
}

window.radix = {
  messageClient,
  connections,
  backgroundClient: backgroundClient,
}

createChromeHandler({
  router: offscreenRouter,
})
