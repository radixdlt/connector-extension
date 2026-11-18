import { logger as utilsLogger } from 'utils/logger'
import { OffscreenMessageHandler } from 'chrome/offscreen/message-handler'
import { MessageClient } from 'chrome/messages/message-client'
import { LogsClient } from './logs-client'
import type { WalletConnectionClient } from './wallet-connection/wallet-connection-client'
import {
  createLinkTransport,
  OffscreenServices,
  WalletConnectionClientFactory,
} from './wallet-connection/factory'
import { LinkRemovalNotices } from './link-removal-notices'
import { shortWalletKey } from './wallet-connection/transport/diagnostics'
import { OffscreenInitializationMessages } from './helpers/offscreen-initialization-messages'
import { offscreenInstance } from './offscreen-instance'
import { NetworkChangeWatcher } from './network-change-watcher'
import { config } from 'config'
import { sendMessage } from 'chrome/helpers/send-message'
import { createMessage } from 'chrome/messages/create-message'
import { runtimeMessageListener } from 'chrome/messages/runtime-listener'

const logsClient = LogsClient()

utilsLogger.attachTransport((logObj) => {
  logsClient.add(logObj)
})

const logger = utilsLogger.getSubLogger({ name: 'offScreen' })

// The first line of every exported log: a new instance means that the document was
// restarted (the logs of the previous one are gone) and reopened every wallet link.
logger.info('offscreen document started', offscreenInstance())

// What the wallet links share: made here, once, and given to whatever needs it.
const services = OffscreenServices()

const connections = new Map<string, WalletConnectionClient>()

// Tells the wallets of forgotten links: each notice's logs name its wallet by the
// short form of its key, as a wallet link's do.
const linkRemovalNotices = LinkRemovalNotices({
  createTransport: (link) =>
    createLinkTransport(
      logger.getSubLogger({
        name: '[notice]',
        prefix: [`wallet=${shortWalletKey(link.walletPublicKey)}`],
      }),
    ),
  onDelivered: (link) =>
    sendMessage(createMessage.linkRemovalDelivered(link.password)),
  sendTimeoutMs: config.webRTC.confirmationTimeout,
  logger,
})

const messageClient = MessageClient(
  OffscreenMessageHandler({
    connectionsMap: connections,
    logger,
    walletConnectionClientFactory: WalletConnectionClientFactory(services),
    services,
    logsClient,
    linkRemovalNotices,
  }),
  'offScreen',
  { logger },
)

chrome.runtime.onMessage.addListener(
  runtimeMessageListener(messageClient, logger),
)

// iroh sessions notice a dead connection only after the QUIC idle timeout: when the
// network may have changed, they check it at once instead.
NetworkChangeWatcher({
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
}).start()

const messages = OffscreenInitializationMessages(messageClient)

messages.options()
messages.sessionRouterData()
messages.connections()
messages.retiredLinks()

declare global {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- declaration merging needs an interface
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
