import {
  ConnectionConfig,
  ConnectorClient,
} from '@radixdlt/radix-connect-webrtc'
import { createMessage } from 'chrome/messages/create-message'
import { config } from 'config'
import { LedgerResponse } from 'ledger/schemas'
import { MessagesRouter } from 'chrome/offscreen/wallet-connection/messages-router'
import { Queue } from 'queues/queue'
import { AppLogger, logger as utilsLogger } from 'utils/logger'
import { Worker } from 'queues/worker'
import { MessageClient } from 'chrome/messages/message-client'
import { WalletConnectionMessageHandler } from './message-handler'
import { Message } from 'chrome/messages/_types'
import { Subscription } from 'rxjs'
import { SyncClient } from './sync-client'
import { SessionRouter } from '../session-router'
import { WalletInteraction } from '@radixdlt/radix-dapp-toolkit'
import { Connection } from 'pairing/state/connections'

export type WalletConnectionClient = ReturnType<typeof WalletConnectionClient>

export const WalletConnectionClient = ({
  messagesRouter,
  connectionPassword,
  logger = utilsLogger,
  syncClient,
  connectorClient,
  walletPublicKey,
  sessionRouter,
}: {
  connectionPassword: string
  messagesRouter: MessagesRouter
  logger: AppLogger
  syncClient: SyncClient
  connectorClient: ConnectorClient
  walletPublicKey: string
  sessionRouter: SessionRouter
}) => {
  logger.info('WalletConnectionClient created', walletPublicKey)
  connectorClient.setConnectionPassword(Buffer.from(connectionPassword, 'hex'))

  const dAppRequestQueue = Queue<WalletInteraction>({
    key: 'dAppRequestQueue',
    logger,
    paused: true,
    worker: Worker(
      (job) =>
        connectorClient
          .sendMessage(job.data, { timeout: config.webRTC.confirmationTimeout })
          .map(() =>
            messagesRouter
              .getByInteractionId(job.data.interactionId)
              .andThen((metadata) =>
                messageClient.sendMessageAndWaitForConfirmation(
                  createMessage.sendMessageEventToDapp(
                    'offScreen',
                    'receivedByWallet',
                    { interactionId: job.data.interactionId, metadata },
                  ),
                  metadata.tabId,
                ),
              ),
          )
          .map((result) => {
            syncClient.addConfirmedInteractionId(job.data.interactionId)
            return result
          })
          .mapErr((error) => {
            const retryIfNotConnected = error.reason === 'notConnected'
            const retryIfMessageFailed = job.numberOfRetries < 3

            return {
              ...error,
              shouldRetry: retryIfNotConnected || retryIfMessageFailed,
            }
          }),
      {
        logger: logger.getSubLogger({ name: 'dAppRequestWorker' }),
      },
    ),
  })

  const extensionToWalletQueue = Queue<LedgerResponse>({
    key: 'extensionToWalletQueue',
    logger,
    worker: Worker(
      (job) =>
        connectorClient.sendMessage(job.data, {
          timeout: config.webRTC.confirmationTimeout,
        }),
      {
        logger: logger.getSubLogger({ name: 'ExtensionToWalletWorker' }),
      },
    ),
  })

  const incomingWalletMessageQueue = Queue<Record<string, any>>({
    key: 'incomingWalletMessageQueue',
    logger,
    paused: false,
    worker: Worker(
      (job) =>
        messageClient
          .handleMessage(
            createMessage.incomingWalletMessage('wallet', job.data),
          )
          .mapErr((err) => {
            logger.error(err)
            return {
              ...err,
              shouldRetry: false,
            }
          }),
      {
        logger: logger.getSubLogger({ name: 'incomingWalletMessageWorker' }),
      },
    ),
  })

  const subscription = new Subscription()

  subscription.add(
    syncClient.dappRequestConfirmedByWallet$.subscribe((interactionId) => {
      dAppRequestQueue.cancel(interactionId)
    }),
  )

  subscription.add(
    syncClient.dappRequestResponseFromWallet$.subscribe((interactionId) => {
      messagesRouter.removeByInteractionId(interactionId)
    }),
  )

  subscription.add(
    connectorClient.connected$.subscribe((connected) => {
      if (connected) {
        extensionToWalletQueue.start()
        dAppRequestQueue.start()
      } else {
        extensionToWalletQueue.stop()
        dAppRequestQueue.stop()
      }
    }),
  )

  const messageClient = MessageClient(
    WalletConnectionMessageHandler({
      dAppRequestQueue,
      extensionToWalletQueue,
      incomingWalletMessageQueue,
      messagesRouter,
      sessionRouter,
      logger,
      walletPublicKey,
    }),
    'offScreen',
    { logger },
  )

  subscription.add(
    connectorClient.onMessage$.subscribe((message) => {
      messageClient.onMessage(createMessage.walletMessage('wallet', message))
    }),
  )

  const chromeMessageListener = (
    message: Message,
    sender: chrome.runtime.MessageSender,
  ) => {
    messageClient.onMessage(message, sender.tab?.id)
  }

  chrome.runtime.onMessage.addListener(chromeMessageListener)

  connectorClient.connect()

  return {
    connectorClient,
    destroy: () => {
      subscription.unsubscribe()
      connectorClient.destroy()
      dAppRequestQueue.destroy()
      extensionToWalletQueue.destroy()
      incomingWalletMessageQueue.destroy()
      chrome.runtime.onMessage.removeListener(chromeMessageListener)
    },
    update: (connection: Connection) => {
      logger.settings.name = `[WCC]:[${connection.walletName}]`
      connectorClient.setConnectionPassword(
        Buffer.from(connection.password, 'hex'),
      )
    },
    setConnectionConfig: (config: ConnectionConfig) =>
      connectorClient.setConnectionConfig(config),
  }
}
