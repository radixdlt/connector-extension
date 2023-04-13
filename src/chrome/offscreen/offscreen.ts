import { config } from 'config'
import { ConnectorClient } from 'connector/connector-client'
import {
  LedgerRequest,
  LedgerResponse,
  createLedgerErrorResponse,
} from 'ledger/schemas'
import { logger } from 'utils/logger'
import { Queue } from 'queues/queue'
import { Worker } from 'queues/worker'
import { MessagesRouter } from 'message-router'
import { createMessage } from 'chrome/messages/create-message'
import { OffscreenMessageHandler } from 'chrome/offscreen/message-handler'
import { MessageClient } from 'chrome/messages/message-client'
import { Message } from 'chrome/messages/_types'
import { filter, switchMap, timer, withLatestFrom } from 'rxjs'

const messageRouter = MessagesRouter({ logger })

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
  worker: Worker((job) =>
    connectorClient
      .sendMessage(job.data, { timeout: config.webRTC.confirmationTimeout })
      .mapErr((error) => {
        const retryIfNotConnected = error.reason === 'notConnected'
        const retryIfMessageFailed = job.numberOfRetries < 3

        return {
          ...error,
          shouldRetry: retryIfNotConnected || retryIfMessageFailed,
        }
      })
  ),
})

const ledgerToWalletQueue = Queue<LedgerResponse>({
  key: 'ledgerToWallet',
  logger,
  worker: Worker((job) =>
    connectorClient.sendMessage(job.data, {
      timeout: config.webRTC.confirmationTimeout,
    })
  ),
})

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

const walletToLedgerQueue = Queue<LedgerRequest>({
  key: 'walletToLedger',
  logger,
  worker: Worker((job) =>
    messageClient
      .sendMessageAndWaitForConfirmation(
        createMessage.walletToLedger('offScreen', job.data)
      )
      .mapErr(() => {
        ledgerToWalletQueue.add(
          createLedgerErrorResponse(job.data, 'ledgerRequestCancelled'),
          job.data.interactionId
        )
        return {
          reason: 'ledgerRequestCancelled',
        }
      })
  ),
})

connectorClient.connected$.subscribe((connected) => {
  if (connected) {
    ledgerToWalletQueue.start()
    dAppRequestQueue.start()
  } else {
    ledgerToWalletQueue.stop()
    dAppRequestQueue.stop()
  }
})

const messageClient = MessageClient(
  OffscreenMessageHandler({
    connectorClient,
    dAppRequestQueue,
    ledgerToWalletQueue,
    walletToLedgerQueue,
    incomingWalletMessageQueue,
    messageRouter,
    logger,
  }),
  'offScreen',
  { logger }
)

connectorClient.onMessage$.subscribe((message) => {
  messageClient.onMessage(createMessage.walletMessage('wallet', message))
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

declare global {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface Window {
    radix: {
      messageRouter: MessagesRouter
      messageClient: MessageClient
    }
  }
}

window.radix = {
  messageClient,
  messageRouter,
}
