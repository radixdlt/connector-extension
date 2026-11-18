import { createMessage } from 'chrome/messages/create-message'
import { config } from 'config'
import type { LedgerResponse } from 'ledger/schemas'
import {
  isLedgerRequest,
  isWalletToExtensionMessage,
  linkRemovedMessage,
} from 'ledger/schemas'
import type { Job } from 'queues/_types'
import { queueInteractionErrorType } from 'queues/_types'
import { Queue } from 'queues/queue'
import type { AppLogger } from 'utils/logger'
import { logger as utilsLogger } from 'utils/logger'
import { Worker } from 'queues/worker'
import { sendMessage } from 'chrome/helpers/send-message'
import type { Observable } from 'rxjs'
import { Subscription, distinctUntilChanged, map } from 'rxjs'
import { ResultAsync, errAsync, okAsync } from 'neverthrow'
import type { WalletInteraction } from '@radixdlt/radix-dapp-toolkit'
import type { Connection } from 'pairing/state/connections'
import {
  handleWalletNotices,
  withTransportDefaults,
  isWalletResponse,
  type TransportMessage,
  type WalletResponse,
  type WalletTransport,
} from './transport/wallet-transport'
import type { TransportConnectionConfig } from './transport/composite-transport'
import {
  shortEndpointIdsOf,
  shortWalletKey,
  type TransportDiagnostics,
  type TransportName,
  type WalletConnectionDiagnostics,
} from './transport/diagnostics'
import { irohLibraryEvents } from './transport/iroh/iroh-library-log'
import type { RequestTracker } from '../requests/request-tracker'
import type { LinkDispatch } from '../requests/dapp-request-dispatcher'

export type WalletConnectionTransport =
  WalletTransport<TransportConnectionConfig> & {
    diagnostics: () => TransportDiagnostics
    /** See `CompositeTransport`; without it, WebRTC while connected. */
    sendingVia$?: Observable<TransportName | undefined>
  }

export type WalletConnectionClient = ReturnType<typeof WalletConnectionClient>

/**
 * When a dApp request the wallet did not receive is sent again: always while no
 * wallet is connected (it waits for one), otherwise until `maxAttempts` attempts.
 */
export const dAppRequestRetryPolicy = {
  maxAttempts: 4,
  shouldRetry: (reason: string | undefined, attempt: number) =>
    reason === 'notConnected' || attempt < dAppRequestRetryPolicy.maxAttempts,
}

/**
 * One wallet link: its transport, the messages it sends the wallet (dApp requests and
 * ledger responses, each in its queue) and the ones the wallet sends. Which link gets
 * a dApp request, and where its answer goes, is the `DAppRequestDispatcher`'s.
 */
export const WalletConnectionClient = ({
  connectionPassword,
  logger = utilsLogger,
  transport: givenTransport,
  walletPublicKey,
  walletName: initialWalletName = '',
  requestTracker,
  dispatch,
}: {
  connectionPassword: string
  logger: AppLogger
  transport: WalletConnectionTransport
  walletPublicKey: string
  walletName?: string
  /** Statuses of the dApp requests, for the popup and the notifications. */
  requestTracker: RequestTracker
  /** Told what the wallet received and answered. */
  dispatch: LinkDispatch
}) => {
  const link = shortWalletKey(walletPublicKey)
  const transport = withTransportDefaults(givenTransport)
  logger.info('WalletConnectionClient created', walletPublicKey)
  let walletName = initialWalletName
  transport.setConnectionPassword(Buffer.from(connectionPassword, 'hex'))

  /** Sends to the wallet, which confirms it within the confirmation timeout. */
  const sendToWallet = (message: Parameters<typeof transport.sendMessage>[0]) =>
    transport.sendMessage(message, {
      timeout: config.webRTC.confirmationTimeout,
    })

  /** Jobs not done yet: waiting, or being sent. */
  const unfinishedJobs = <T>(queue: Queue<T>) =>
    queue
      .getState()
      .map((state) => state.ids.pending.size + state.ids.processing.size)
      .orElse(() => okAsync(-1))

  const pending = () =>
    ResultAsync.combine([
      unfinishedJobs(dAppRequestQueue),
      unfinishedJobs(extensionToWalletQueue),
    ]).map(([dAppRequests, ledgerResponses]) => ({
      dAppRequests,
      ledgerResponses,
    }))

  /**
   * One request of a dApp at a time: the next waits, still cancellable here and by its
   * dApp, until the one in a wallet is answered (see `RequestTracker.takeTurn`).
   */
  const sendDAppRequest = (
    job: Job<WalletInteraction>,
  ): ResultAsync<void, { reason: string }> => {
    const { interactionId } = job.data
    if (!requestTracker.takeTurn(interactionId, link))
      return errAsync({ reason: 'waitingForTurn' })
    return sendToWallet(job.data)
      .map(() => {
        requestTracker.delivered(interactionId, link)
        requestTracker.sendingEnded(interactionId, link)
      })
      .mapErr((error) => {
        requestTracker.sendingEnded(interactionId, link)
        return error
      })
  }

  const dAppRequestQueue = Queue<WalletInteraction>({
    key: 'dAppRequestQueue',
    logger,
    paused: true,
    isReady: (job) => requestTracker.mayGo(job.data.interactionId, link),
    worker: Worker(
      (job) =>
        sendDAppRequest(job)
          .map(() => {
            logger.info('dApp request delivered to the wallet', {
              interactionId: job.data.interactionId,
              attempt: job.numberOfRetries + 1,
              queuedForMs: Date.now() - job.createdAt,
            })
          })
          .map(() => dispatch.delivered(job.data.interactionId, link))
          .mapErr((error) => {
            // Not an attempt: it waits, pending, for its dApp's earlier request.
            if (error.reason === 'waitingForTurn')
              return { ...error, shouldRetry: true }
            const attempt = job.numberOfRetries + 1
            const waitingForWallet = error.reason === 'notConnected'
            const shouldRetry = dAppRequestRetryPolicy.shouldRetry(
              error.reason,
              attempt,
            )

            if (!shouldRetry)
              requestTracker.released(job.data.interactionId, link, true)
            if (!waitingForWallet)
              logger[shouldRetry ? 'warn' : 'error'](
                shouldRetry
                  ? 'dApp request not delivered, retrying'
                  : 'dApp request not delivered, giving up',
                {
                  interactionId: job.data.interactionId,
                  reason: error.reason,
                  attempt,
                  maxAttempts: dAppRequestRetryPolicy.maxAttempts,
                },
              )

            return { ...error, shouldRetry }
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
        sendToWallet(job.data)
          .map(() =>
            logger.info('ledger response delivered to the wallet', {
              interactionId: job.data.interactionId,
            }),
          )
          .mapErr((error) => {
            // Not retried: the wallet asks again if it needs to.
            logger.warn('ledger response not delivered', {
              interactionId: job.data.interactionId,
              reason: error.reason,
            })
            return error
          }),
      {
        logger: logger.getSubLogger({ name: 'ExtensionToWalletWorker' }),
      },
    ),
  })

  const incomingWalletMessageQueue = Queue<WalletResponse>({
    key: 'incomingWalletMessageQueue',
    logger,
    paused: false,
    worker: Worker(
      (job) =>
        dispatch
          .walletResponse(job.data, { link, walletPublicKey })
          .map(() => undefined)
          .mapErr((err) => {
            // A response without a dApp tab is logged by the handler.
            if (err.reason !== 'tabIdNotFound')
              logger.warn('wallet response not passed on to the dApp', {
                interactionId: job.data?.interactionId,
                reason: err.reason,
              })
            return { ...err, shouldRetry: false }
          }),
      {
        logger: logger.getSubLogger({ name: 'incomingWalletMessageWorker' }),
      },
    ),
  })

  const subscription = new Subscription()

  // An earlier request of a dApp answered, cancelled or lost: the next one may go.
  subscription.add(requestTracker.onTurnChange(() => dAppRequestQueue.wake()))

  let wasReachable = false
  subscription.add(
    transport.connected$.pipe(distinctUntilChanged()).subscribe((connected) => {
      // Not reachable before the first connection: nothing worth a line.
      const changed = connected || wasReachable
      wasReachable = connected
      requestTracker.linkConnected(link, connected)
      if (connected) {
        extensionToWalletQueue.start()
        dAppRequestQueue.start()
      } else {
        extensionToWalletQueue.stop()
        dAppRequestQueue.stop()
      }
      if (changed)
        pending().map((counts) =>
          logger.info(
            connected
              ? 'wallet reachable: sending queued messages'
              : 'wallet not reachable: holding messages until it reconnects',
            counts,
          ),
        )
    }),
  )

  /**
   * A message from the wallet: a ledger request and a message for the extension (an
   * account list, the removal of the link) go to the background; anything else is the
   * answer to a dApp request, queued once for the dApp (the same answer may come over
   * both transports).
   */
  const fromWallet = (message: TransportMessage) => {
    const ids = {
      discriminator: message?.discriminator,
      interactionId: message?.interactionId,
    }
    if (isLedgerRequest(message)) {
      logger.info('wallet message: ledger request, forwarding it', ids)
      // eslint-disable-next-line no-void -- fire-and-forget
      void sendMessage(
        createMessage.walletToLedger('offScreen', message, walletPublicKey),
      )
    } else if (isWalletToExtensionMessage(message)) {
      logger.info('wallet message: for the extension, forwarding it', ids)
      // eslint-disable-next-line no-void -- fire-and-forget
      void sendMessage(
        createMessage.walletToExtension('offScreen', message, walletPublicKey),
      )
    } else if (!isWalletResponse(message))
      logger.info('wallet message: dropped, it names no dApp request', ids)
    else
      incomingWalletMessageQueue
        .add(message, message.interactionId)
        .map(() =>
          logger.info('wallet message: response to a dApp, queued', ids),
        )
        .mapErr((error) =>
          logger.info(
            error.reason === queueInteractionErrorType.JobAlreadyExistsError
              ? 'wallet message: dropped, a response for this interaction was already received'
              : 'wallet message: dropped',
            { ...ids, reason: error.reason },
          ),
        )
  }

  subscription.add(
    transport.onMessage$.subscribe((message) => {
      // The wallet removed this link: it gets the same message back (best effort),
      // which ends its notice, before the extension forgets the link.
      if (message?.discriminator === linkRemovedMessage.discriminator)
        sendToWallet(linkRemovedMessage).mapErr((error) =>
          logger.info('could not answer the removal of the link', {
            reason: error.reason,
          }),
        )
      fromWallet(message)
    }),
  )

  // What the wallet tells beyond its messages (iroh): a request it lost delivered
  // again, and whether its app is in the background.
  requestTracker.walletOf(link, {
    reportsRequests: transport.reportsRequests,
  })
  subscription.add(
    transport.walletNotices$.subscribe(
      handleWalletNotices({
        requestRedelivered: ({ interactionId }) =>
          requestTracker.redelivered(interactionId, link),
        presence: ({ inBackground }) =>
          requestTracker.walletInBackground(link, inBackground),
        walletClosed: () => requestTracker.walletClosed(link),
        // WebRTC: the wallet lost these with its app; they go to it again, by the same
        // queue (over iroh the library does this itself).
        requestsHeld: ({ interactionIds, since }) => {
          for (const interactionId of requestTracker.heldBy(
            link,
            interactionIds,
            since,
          )) {
            logger.info(
              'the wallet lost a request with its app: sending it again',
              { interactionId },
            )
            // eslint-disable-next-line no-void -- fire-and-forget
            void client.resendRequest(interactionId)
          }
        },
      }),
    ),
  )

  transport.connect()

  const client = {
    /** This link, by its short wallet key. */
    link,
    walletPublicKey,
    destroy: () => {
      subscription.unsubscribe()
      transport.destroy()
      dAppRequestQueue.destroy()
      extensionToWalletQueue.destroy()
      incomingWalletMessageQueue.destroy()
      requestTracker.linkConnected(link, false)
      logger.info('wallet link closed')
    },
    /** Queues a dApp request for the wallet (see `DAppRequestDispatcher`). */
    queueRequest: (request: WalletInteraction) =>
      dAppRequestQueue.add(request, request.interactionId),
    /**
     * Takes a dApp request out of this link's queue if it was not sent to the wallet
     * yet: fails when it was, or when this link does not have it.
     */
    cancelRequest: (interactionId: string) =>
      dAppRequestQueue.cancel(interactionId),
    /** Queues a ledger device's response for the wallet that asked for it. */
    sendLedgerResponse: (response: LedgerResponse) => {
      logger.info('ledger response queued for the wallet', {
        interactionId: response.interactionId,
        discriminator: response.discriminator,
      })
      return extensionToWalletQueue
        .add(response, response.interactionId)
        .map(() => undefined)
    },
    /**
     * Sends again a request this link's wallet received but did not answer (it
     * disconnected meanwhile, and may have lost it), with the same interaction id,
     * so that its answer still reaches the dApp. Resolves with whether it was.
     */
    resendRequest: (interactionId: string): ResultAsync<boolean, never> =>
      dAppRequestQueue
        .getState()
        .andThen((state) => {
          const job = state.items.get(interactionId)
          // Only a finished one: one still being sent would mark the new copy done.
          if (!job || job.status === 'pending' || job.status === 'processing')
            return okAsync(false)
          return dAppRequestQueue
            .remove(interactionId)
            .andThen(() => dAppRequestQueue.add(job.data, interactionId))
            .map(() => {
              logger.info('dApp request sent again to the wallet', {
                interactionId,
              })
              requestTracker.resent(interactionId, link)
              return true
            })
        })
        .orElse(() => okAsync(false)),
    /** Forgets a request this link already sent: its wallet no longer answers it. */
    forgetRequest: (interactionId: string): ResultAsync<void, never> => {
      // Nor sent again by a transport that does so by itself (iroh).
      transport.forgetRequest(interactionId)
      return dAppRequestQueue
        .remove(interactionId)
        .map(() => undefined)
        .orElse(() => okAsync(undefined))
    },
    update: (connection: Connection) => {
      walletName = connection.walletName
      transport.setConnectionPassword(Buffer.from(connection.password, 'hex'))
    },
    setConnectionConfig: (config: TransportConnectionConfig) =>
      transport.setConnectionConfig(config),
    /** The connected transport the next message goes through, on each change. */
    sendingVia$:
      transport.sendingVia$ ??
      transport.connected$.pipe(
        map((connected): TransportName | undefined =>
          connected ? 'webrtc' : undefined,
        ),
      ),
    /** The computer is active again: renews the link's idle connections. */
    restart: () => transport.restart(),
    /** `reason`: `online`, `wake after 42s`... (see `NetworkChangeWatcher`). */
    networkChanged: transport.networkChanged,
    /** Ids, states and counts only. */
    diagnostics: (): WalletConnectionDiagnostics => {
      const transportDiagnostics = transport.diagnostics()
      const endpoints = shortEndpointIdsOf(
        transportDiagnostics.iroh?.session?.summary,
      )
      const libraryEvents = endpoints.length
        ? irohLibraryEvents
            .list()
            .filter((event) =>
              endpoints.some((id) => event.message.includes(id)),
            )
        : []
      return {
        walletName,
        walletKey: shortWalletKey(walletPublicKey),
        ...transportDiagnostics,
        ...(libraryEvents.length ? { irohLibraryEvents: libraryEvents } : {}),
      }
    },
    /** `diagnostics`, with the messages waiting to be sent. */
    diagnosticsWithQueues: (): ResultAsync<
      WalletConnectionDiagnostics,
      never
    > =>
      pending().map((counts) => ({
        ...client.diagnostics(),
        pending: counts,
      })),
  }
  return client
}
