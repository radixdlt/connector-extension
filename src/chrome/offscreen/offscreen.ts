import { LedgerRequestSchema } from './../../ledger/schemas'
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
import {
  NEVER,
  Observable,
  Subject,
  catchError,
  filter,
  finalize,
  switchMap,
  tap,
  timer,
  withLatestFrom,
} from 'rxjs'
import { validateZodSchema } from 'chrome/helpers/validate-zod-schema'

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
      .map(() =>
        messageRouter
          .getTabId(job.data.interactionId)
          .andThen((tabId) =>
            messageClient.sendMessageAndWaitForConfirmation(
              createMessage.sendMessageEventToDapp(
                'offScreen',
                'receivedByWallet',
                job.data.interactionId
              ),
              tabId
            )
          )
      )
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

const walletToLedgerSubject = new Subject<LedgerRequest>()

walletToLedgerSubject
  .asObservable()
  .pipe(
    tap((message) =>
      logger.debug(
        '🪪 -> 📒: walletToLedgerSubject',
        message.interactionId,
        message.discriminator
      )
    ),
    switchMap((message) =>
      new Observable((subscriber) => {
        messageClient
          .sendMessageAndWaitForConfirmation(createMessage.closeLedgerTab())
          .andThen(() => validateZodSchema(LedgerRequestSchema, message))
          .andThen((message) =>
            messageClient.sendMessageAndWaitForConfirmation(
              createMessage.walletToLedger('offScreen', message)
            )
          )
          .mapErr((error) => subscriber.error(error.reason))
      }).pipe(
        catchError((error) => {
          logger.debug('🪪 -> 📒: walletToLedgerSubject error', error)
          ledgerToWalletQueue.add(
            createLedgerErrorResponse(message, error),
            message.interactionId
          )
          return NEVER
        }),
        finalize(() => {
          logger.debug('🪪 -> 📒: walletToLedgerSubject finalize', message)
          ledgerToWalletQueue.add(
            createLedgerErrorResponse(message, 'ledgerRequestCancelled'),
            message.interactionId
          )
        })
      )
    )
  )
  .subscribe()

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
    walletToLedgerSubject,
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
