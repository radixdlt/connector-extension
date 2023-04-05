import { config } from 'config'
import { ConnectorClient } from 'connector/connector-client'
import { logger } from 'utils/logger'
import { Queue } from 'queues/queue'
import { Worker } from 'queues/worker'
import { okAsync } from 'neverthrow'
import { MessagesRouter } from 'message-router'
import { createMessage } from 'chrome/messages/create-message'
import { OffscreenMessageHandler } from 'chrome/messages/offscreen-messages'
import { OffScreenMessage } from 'chrome/messages/_types'
import { sendMessage } from 'chrome/helpers/send-message'
import { MessageHandler } from 'chrome/messages/message-handler'

const messageRouter = MessagesRouter()

const connectorClient = ConnectorClient({
  source: 'extension',
  target: 'wallet',
  signalingServerBaseUrl: config.signalingServer.baseUrl,
  isInitiator: true,
  logger,
})

connectorClient.connect()

const dAppRequestQueue = Queue<any>({
  key: 'dAppRequestQueue',
  logger,
  paused: true,
  worker: Worker((job) => {
    connectorClient.sendMessage(job.data)
    return okAsync(undefined)
  }),
})

const walletResponseQueue = Queue<any>({
  key: 'walletResponseQueue',
  logger,
  paused: false,
  worker: Worker((job) =>
    messageRouter
      .getTabId(job.data.interactionId)
      .map((tabId) => createMessage.sendMessageToTab(tabId, job.data))
      .andThen(sendMessage)
      .mapErr((error) => {
        logger.error(`walletResponseQueueError`, { error, job })
        return { error, shouldRetry: false }
      })
  ),
})

connectorClient.connected$.subscribe((connected) => {
  if (connected) {
    dAppRequestQueue.start()
  } else {
    dAppRequestQueue.stop()
  }
})

const messageHandler = MessageHandler({
  offscreenMessageHandler: OffscreenMessageHandler({
    connectorClient,
    logger,
    dAppRequestQueue,
    walletResponseQueue,
    messageRouter,
  }),
})

connectorClient.onMessage$.subscribe((message) =>
  walletResponseQueue.add(message, message.interactionId)
)

chrome.runtime.onMessage.addListener((message: OffScreenMessage, sender) => {
  messageHandler.onMessage(message, sender.tab?.id)
})
