import { config } from 'config'
import { ConnectorClient } from 'connector/connector-client'
import { logger } from 'utils/logger'
import { Queue } from 'queues/queue'
import { Worker } from 'queues/worker'
import { okAsync } from 'neverthrow'
import { MessagesRouter } from 'message-router'
import { createMessage } from 'chrome/messages/create-message'
import { OffscreenMessageHandler } from 'chrome/offscreen/message-handler'
import { MessageClient } from 'chrome/messages/message-client'
import { Message } from 'chrome/messages/_types'
import { filter, switchMap, timer, withLatestFrom } from 'rxjs'

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
    // TODO: extract message queue logic from connectorClient
    connectorClient.sendMessage(job.data)
    return okAsync(undefined)
  }),
})

connectorClient.connected$.subscribe((connected) => {
  if (connected) {
    dAppRequestQueue.start()
  } else {
    dAppRequestQueue.stop()
  }
})

const messageClient = MessageClient(
  OffscreenMessageHandler({
    connectorClient,
    dAppRequestQueue,
    messageRouter,
    logger,
  }),
  'offScreen',
  {}
)

const incomingWalletMessageQueue = Queue<Record<string, any>>({
  key: 'incomingWalletMessageQueue',
  logger,
  paused: false,
  worker: Worker((job) =>
    messageClient
      .handleMessage(createMessage.incomingWalletMessage('wallet', job.data))
      .mapErr((err) => ({
        ...err,
        shouldRetry: false,
      }))
  ),
})

connectorClient.onMessage$.subscribe((message) => {
  incomingWalletMessageQueue.add(message, message.interactionId)
})

chrome.runtime.onMessage.addListener((message: Message, sender) => {
  messageClient.onMessage(message, sender.tab?.id)
})

const TWO_MINUTES = 120_000
const everyTwoMinute$ = timer(0, TWO_MINUTES)

everyTwoMinute$
  .pipe(
    withLatestFrom(connectorClient.connected$, connectorClient.shouldConnect$),
    filter(([, connected, shouldConnect]) => !connected && shouldConnect),
    switchMap(() =>
      messageClient
        .sendMessageAndWaitForConfirmation<{ connectionPassword: string }>(
          createMessage.getConnectionPassword('offScreen')
        )
        .map(({ connectionPassword }) => connectionPassword)
        .andThen((connectionPassword) =>
          messageClient.handleMessage(
            createMessage.setConnectionPassword('offScreen', connectionPassword)
          )
        )
    )
  )
  .subscribe()
