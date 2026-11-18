import { ResultAsync, errAsync, okAsync } from 'neverthrow'
import type {
  WalletInteraction,
  WalletInteractionExtensionInteraction,
} from '@radixdlt/radix-dapp-toolkit'
import { createMessage } from 'chrome/messages/create-message'
import { MessageClient } from 'chrome/messages/message-client'
import type { Message, MessageHandlerOutput } from 'chrome/messages/_types'
import { handleMessages } from 'chrome/messages/_types'
import { isAllowedFrom } from 'chrome/messages/trusted-senders'
import { sendMessage } from 'chrome/helpers/send-message'
import { MessagesRouter } from 'chrome/offscreen/wallet-connection/messages-router'
import type { QueueInteractionError } from 'queues/_types'
import { queueInteractionErrorType } from 'queues/_types'
import type { AppLogger } from 'utils/logger'
import type { SessionRouter } from '../session-router'
import type { RequestTracker } from './request-tracker'
import type { WalletResponse } from '../wallet-connection/transport/wallet-transport'
import {
  expiredRequests,
  originHostOf,
  requestKindOf,
  type PendingRequestExpiry,
} from './pending-request'

/** How often pending requests are checked for expiry. */
const EXPIRY_CHECK_INTERVAL_MS = 10_000

/** What the dispatcher asks of a wallet link: its queue of dApp requests. */
export type DispatchedLink = {
  /** The link, by its short wallet key. */
  link: string
  walletPublicKey: string
  queueRequest: (
    request: WalletInteraction,
  ) => ResultAsync<unknown, QueueInteractionError>
  cancelRequest: (
    interactionId: string,
  ) => ResultAsync<unknown, QueueInteractionError>
  resendRequest: (interactionId: string) => ResultAsync<boolean, never>
  forgetRequest: (interactionId: string) => ResultAsync<void, never>
}

/** What a wallet link tells the dispatcher about its dApp requests. */
export type LinkDispatch = {
  /** Its wallet confirmed it received the request. */
  delivered: (interactionId: string, link: string) => void
  /** Its wallet answered a dApp request: the answer goes to the dApp's tab. */
  walletResponse: (
    response: WalletResponse,
    from: { link: string; walletPublicKey: string },
  ) => ResultAsync<unknown, { reason: string }>
}

export type DAppRequestDispatcher = ReturnType<typeof DAppRequestDispatcher>

/**
 * The one way of the dApp requests through the offscreen document: it hears the
 * dApps' messages, remembers each request's tab, queues the request on the links that
 * may serve its session, and passes the wallet's answer back to the tab. Cancelling,
 * sending again and expiry happen here too; each link only sends what it is given.
 */
export const DAppRequestDispatcher = (input: {
  /** The open wallet links, by wallet public key. */
  links: ReadonlyMap<string, DispatchedLink>
  requestTracker: RequestTracker
  sessionRouter: SessionRouter
  logger: AppLogger
  /** How long a request may wait for a wallet: read at each check. */
  expiry: () => PendingRequestExpiry
  /** Its `MessageClient`'s subjects and sending (tests): the runtime's by default. */
  messaging?: Omit<Parameters<typeof MessageClient>[2], 'logger'>
}) => {
  const { links, requestTracker, sessionRouter, logger } = input
  const tabs = MessagesRouter()
  const allLinks = () => Array.from(links.values())

  /** The links that take a request: the wallet of its session, or every one. */
  const linksFor = (sessionId: string | undefined) => {
    const wallet = sessionRouter.getWalletPublicKey(sessionId)
    return wallet
      ? allLinks().filter((link) => link.walletPublicKey === wallet)
      : allLinks()
  }

  /** The link whose wallet received a request, if one did. */
  const receivingLink = (interactionId: string) => {
    const request = requestTracker.get(interactionId)
    if (!request?.delivered) return undefined
    return allLinks().find((link) => link.link === request.wallets[0])
  }

  /* eslint-disable max-params -- internal helpers, each with an optional tabId last */
  /** Tells the dApp's tab of a request an event of its life (see `MessageLifeCycleEvent`). */
  const tellDapp = (
    event: Parameters<typeof createMessage.sendMessageEventToDapp>[1],
    interactionId: string,
    metadata: { origin: string },
    tabId?: number,
  ) =>
    messageClient.sendMessageAndWaitForConfirmation(
      createMessage.sendMessageEventToDapp('offScreen', event, {
        interactionId,
        metadata,
      }),
      tabId,
    )

  /**
   * Ends the dApp's request as the wallet does when the user rejects it: a failure
   * response to the dApp's tab.
   */
  const rejectToDapp = (
    interactionId: string,
    why: { error: string; message: string } = {
      error: 'rejectedByUser',
      message: 'Cancelled in the Radix Wallet Connector',
    },
  ): ResultAsync<void, Error> =>
    tabs
      .getByInteractionId(interactionId)
      .andThen((metadata) =>
        messageClient
          .sendMessageAndWaitForConfirmation(
            createMessage.walletResponse('offScreen', {
              walletResponse: {
                discriminator: 'failure',
                interactionId,
                ...why,
              },
              metadata,
            }),
            metadata.tabId,
          )
          .mapErr(
            (error) =>
              new Error(`could not reach the dApp's tab: ${error.reason}`),
          ),
      )
      .map(() => {
        tabs.removeByInteractionId(interactionId)
      })

  /**
   * Takes a request not sent to a wallet yet out of every link's queue. Fails when no
   * link had it waiting: sent already, or never queued.
   */
  const cancelQueued = (
    interactionId: string,
    source: string,
  ): ResultAsync<void, QueueInteractionError> =>
    ResultAsync.fromSafePromise(
      Promise.all(
        allLinks().map((link) =>
          link.cancelRequest(interactionId).match(
            () => undefined,
            (error) => error,
          ),
        ),
      ),
    ).andThen((errors) => {
      if (!errors.some((error) => !error))
        return errAsync({
          reason: errors.some(
            (error) =>
              error?.reason ===
              queueInteractionErrorType.FailedToCancelJobError,
          )
            ? queueInteractionErrorType.FailedToCancelJobError
            : queueInteractionErrorType.JobNotFoundError,
        })
      logger.info('dApp request cancelled before reaching the wallet', {
        interactionId,
        source,
      })
      requestTracker.cancelled(interactionId)
      return okAsync(undefined)
    })

  /** Cancels a request not sent to a wallet yet, and tells its dApp. */
  const cancelAndTellDapp = (
    interactionId: string,
    metadata: WalletInteraction['metadata'],
    source: string,
    tabId?: number,
  ) =>
    cancelQueued(interactionId, source)
      .mapErr((error) => {
        logger.info('dApp request not cancelled', {
          interactionId,
          source,
          reason:
            error.reason === queueInteractionErrorType.FailedToCancelJobError
              ? 'already sent to the wallet'
              : 'not queued for a wallet',
        })
        return error
      })
      .andThen(() =>
        tellDapp('requestCancelSuccess', interactionId, metadata, tabId),
      )

  /**
   * A dApp request from a tab: remembers the tab for the answer, then cancels the
   * request it names (`cancelRequest`) or queues it for the links of its session.
   */
  const handleDappRequest = (
    request: WalletInteraction,
    routedMetadata: Parameters<MessagesRouter['add']>[2],
    sessionId: string | undefined,
    tabId?: number,
  ): MessageHandlerOutput => {
    const { interactionId, metadata, items } = request
    return tabs
      .add(tabId!, interactionId, routedMetadata)
      .asyncAndThen(() => {
        if (items.discriminator === 'cancelRequest')
          return cancelAndTellDapp(
            interactionId,
            metadata,
            'cancelRequest',
            tabId,
          )
        const takers = linksFor(sessionId)
        if (!takers.length) return okAsync(undefined)
        logger.info('dApp request queued for the wallet', {
          interactionId,
          kind: items.discriminator,
          session: sessionRouter.getWalletPublicKey(sessionId)
            ? 'its wallet'
            : 'any wallet',
          wallets: takers.map((link) => link.link).join(', '),
        })
        const details = {
          origin: originHostOf(metadata?.origin),
          kind: requestKindOf(items),
        }
        return ResultAsync.combine(
          takers.map((link) =>
            link
              .queueRequest({ items, metadata, interactionId })
              .map(() =>
                requestTracker.track(interactionId, details, link.link),
              ),
          ),
        )
      })
      .map(() => ({ sendConfirmation: true }))
  }
  /* eslint-enable max-params */

  const messageClient = MessageClient(
    handleMessages({
      cancelWalletInteraction: (message, _send, tabId) => {
        const { interactionId, metadata } = message.interaction
        return cancelAndTellDapp(
          interactionId,
          metadata,
          'cancelWalletInteraction',
          tabId,
        ).map(() => ({ sendConfirmation: true }))
      },
      // A dApp request from the dApp toolkit: may name a session, of one wallet.
      walletInteraction: (message, _send, tabId) => {
        const { interactionId, sessionId, interaction } =
          message.interaction as WalletInteractionExtensionInteraction
        const walletInteraction: WalletInteraction = {
          ...interaction,
          interactionId,
        }
        return handleDappRequest(
          walletInteraction,
          { ...interaction.metadata, sessionId },
          sessionId,
          tabId,
        )
      },
      // A dApp request without a session: for any wallet.
      dAppRequest: (message, _send, tabId) =>
        handleDappRequest(
          message.data,
          message.data.metadata,
          undefined,
          tabId,
        ),
    }),
    'offScreen',
    { logger, ...input.messaging },
  )

  // Web pages may only send the messages they need (see `isAllowedFrom`).
  const chromeMessageListener = (
    message: Message,
    sender: chrome.runtime.MessageSender,
  ) => {
    if (!isAllowedFrom(message, sender)) return
    messageClient.onMessage(message, sender.tab?.id)
  }
  chrome.runtime.onMessage.addListener(chromeMessageListener)

  /**
   * Cancels a dApp request from the popup, as the dApp's own cancel does: one not
   * sent to the wallet yet (the wallet has no way to take one back), taken out of
   * every link's queue, then rejected to the dApp; or one whose wallet
   * disconnected without answering, forgotten by its link.
   */
  const cancel = (
    interactionId: string,
    why?: { error: string; message: string },
  ) =>
    cancelQueued(interactionId, 'popup')
      .map(() => true)
      .orElse(() => {
        const request = requestTracker.get(interactionId)
        if (
          request?.status === 'walletDisconnected' &&
          receivingLink(interactionId)
        ) {
          requestTracker.cancelled(interactionId)
          return okAsync(true)
        }
        logger.info('dApp request not cancelled from the popup', {
          interactionId,
          status: request?.status ?? 'unknown request',
        })
        return okAsync(false)
      })
      .andThen((cancelled) => {
        if (!cancelled)
          return okAsync({
            cancelled: false,
            status: requestTracker.get(interactionId)?.status,
          })
        // Every link forgets it: none sends it again to a wallet opened later.
        // eslint-disable-next-line no-void -- fire-and-forget
        for (const link of allLinks()) void link.forgetRequest(interactionId)
        return rejectToDapp(interactionId, why)
          .map(() => ({ cancelled: true }))
          .orElse((error) => {
            logger.warn('dApp request cancelled, but the dApp was not told', {
              interactionId,
              message: error.message,
            })
            return okAsync({ cancelled: true })
          })
      })

  /**
   * Cancels the requests that waited longer than the option allows with no wallet
   * answering them (see `expiredRequests`): the dApp hears a timeout instead of waiting
   * for good. Checked every few seconds.
   */
  const cancelExpired = () => {
    const expiry = input.expiry()
    for (const request of expiredRequests(
      requestTracker.list(),
      expiry,
      Date.now(),
    )) {
      logger.info('dApp request cancelled: no wallet answered it in time', {
        interactionId: request.interactionId,
        status: request.status,
        expiry,
      })
      // eslint-disable-next-line no-void -- fire-and-forget
      void cancel(request.interactionId, {
        error: 'timeout',
        message:
          'No wallet answered in time: cancelled by the Radix Wallet Connector',
      })
    }
  }
  const expiryTimer = setInterval(cancelExpired, EXPIRY_CHECK_INTERVAL_MS)

  const linkDispatch: LinkDispatch = {
    delivered: (interactionId, deliveredBy) => {
      // The dApp hears it in the background: waiting for its tab (up to the
      // confirmation timeout) would hold the link's next request back.
      // eslint-disable-next-line no-void -- fire-and-forget
      void tabs
        .getByInteractionId(interactionId)
        .andThen((metadata) =>
          tellDapp('receivedByWallet', interactionId, metadata, metadata.tabId),
        )
        .mapErr((error) =>
          logger.info("the dApp's tab did not hear the wallet received it", {
            interactionId,
            reason: 'reason' in error ? error.reason : 'unknown',
          }),
        )
      // The request went to every link that may serve its session: the others no
      // longer need to send it.
      for (const link of allLinks())
        if (link.link !== deliveredBy)
          link.cancelRequest(interactionId).map(() => {
            logger.debug('dApp request delivered by another link: dropped', {
              interactionId,
              wallet: link.link,
            })
            requestTracker.released(interactionId, link.link)
          })
    },
    walletResponse: (response, from) => {
      const { interactionId } = response
      requestTracker.answered(
        interactionId,
        response.discriminator === 'success',
      )
      return tabs
        .getByInteractionId(interactionId)
        .mapErr(() => {
          logger.warn(
            'wallet response dropped: no dApp tab is waiting for it',
            {
              interactionId,
            },
          )
          return { reason: 'tabIdNotFound' }
        })
        .andThen((metadata) => {
          tabs.removeByInteractionId(interactionId)
          // For the background: the notifications, and which wallet a session is with.
          sendMessage(
            createMessage.walletResponse('offScreen', {
              ...response,
              metadata: {
                networkId: metadata.networkId,
                sessionId: metadata.sessionId,
                walletPublicKey: from.walletPublicKey,
              },
            }),
          )
          return messageClient.sendMessageAndWaitForConfirmation(
            createMessage.walletResponse('offScreen', {
              walletResponse: response,
              metadata,
            }),
            metadata.tabId,
          )
        })
    },
  }

  return {
    /** What each link is given, to tell the dispatcher about its requests. */
    linkDispatch,
    cancel,
    /**
     * Sends again a request whose wallet disconnected without answering, to that
     * wallet: the user knows whether it was closed and lost it.
     */
    resend: (interactionId: string) => {
      const request = requestTracker.get(interactionId)
      const link = receivingLink(interactionId)
      // A wallet that reports its requests gets a lost one back by itself.
      if (
        request?.status !== 'walletDisconnected' ||
        request.comesBack ||
        !link
      ) {
        logger.info('dApp request not sent again from the popup', {
          interactionId,
          status: request?.status ?? 'unknown request',
        })
        return okAsync({ resent: false })
      }
      return link.resendRequest(interactionId).map((resent) => ({ resent }))
    },
    destroy: () => {
      clearInterval(expiryTimer)
      chrome.runtime.onMessage.removeListener(chromeMessageListener)
      messageClient.destroy()
    },
  }
}
