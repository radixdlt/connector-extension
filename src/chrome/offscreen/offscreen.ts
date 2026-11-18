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
import { NetworkChangeWatcher } from './network-change-watcher'
import { config } from 'config'
import {
  usesIroh,
  type RadixConnectTransport,
} from 'options/radix-connect-transport'

const logsClient = LogsClient()

utilsLogger.attachTransport((logObj) => {
  logsClient.add(logObj)
})

const logger = utilsLogger.getSubLogger({ name: 'offScreen' })

const connections = new Map<string, WalletConnectionClient>()

// iroh sessions notice a dead connection only after the QUIC idle timeout: when the
// network may have changed, they check it at once instead. Runs only while iroh is
// selected (never in builds without iroh).
const networkChangeWatcher = NetworkChangeWatcher({
  target: window,
  logger,
  wakeCheckIntervalMs: config.iroh.wakeCheckInterval,
  wakeGapThresholdMs: config.iroh.wakeGapThreshold,
  debounceMs: config.iroh.networkChangeDebounce,
  onNetworkChange: (reason) => {
    logger.info('network change: checking the iroh connections', {
      reason,
      links: connections.size,
    })
    for (const [, connection] of connections) connection.networkChanged(reason)
  },
})
let watchingNetwork = false
const watchNetworkFor = (transport: RadixConnectTransport) => {
  const needed = usesIroh(transport)
  if (needed === watchingNetwork) return
  watchingNetwork = needed
  if (needed) networkChangeWatcher.start()
  else networkChangeWatcher.stop()
}

const messageClient = MessageClient(
  OffscreenMessageHandler({
    connectionsMap: connections,
    logger,
    walletConnectionClientFactory,
    logsClient,
    onTransportConfig: ({ transport }) => watchNetworkFor(transport),
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
