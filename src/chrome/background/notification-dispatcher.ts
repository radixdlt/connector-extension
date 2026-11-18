import type { TransactionStatus } from '@radixdlt/babylon-gateway-api-sdk'
import { createAndFocusTab } from 'chrome/helpers/create-and-focus-tab'
import { ResultAsync, okAsync } from 'neverthrow'
import { createNotification } from 'chrome/helpers/chrome-notifications'
import { transactionExplorerUrl } from 'utils/explorer'
import type { RequestKind } from 'chrome/offscreen/requests/pending-request'
import type { RequestNotification } from 'chrome/offscreen/requests/request-tracker'
import {
  getShowDAppRequestNotifications,
  getShowTransactionResultNotifications,
} from 'options'

/**
 * Notification ids: their kind, then their details, joined by `___`. Built and read
 * only here.
 */
const idSeparator = '___'

/** The id of a dApp request's notification: one per request, updated in place. */
export const requestNotificationId = (interactionId: string) =>
  ['dAppRequest', interactionId].join(idSeparator)

const transactionNotificationId = (networkId: number, txId: string) =>
  ['transaction', networkId, txId].join(idSeparator)

/** A new id for each removed link's notification: they do not replace each other. */
const linkRemovedNotificationId = () =>
  ['linkRemoved', crypto.randomUUID()].join(idSeparator)

/** The transaction a notification is about, if it is a transaction's. */
export const transactionOfNotification = (
  notificationId: string,
): { networkId: number; txId: string } | undefined => {
  const [kind, networkId, txId] = notificationId.split(idSeparator)
  if (kind !== 'transaction' || !txId) return undefined
  return { networkId: Number(networkId), txId }
}

/** A transaction's notification opens it on the explorer. */
export const onNotificationClicked = (notificationId: string) => {
  const transaction = transactionOfNotification(notificationId)
  if (transaction) createAndFocusTab(transactionExplorerUrl(transaction.txId))
}

const requestTitles: Record<RequestKind, string> = {
  login: 'Login Request Pending',
  data: 'Data Request Pending',
  transaction: 'Transaction Request Pending',
  preAuthorization: 'Pre-authorization Request Pending',
  request: 'Request Pending',
}

// With the wallet connected: where to review it.
const reviewMessages: Record<RequestKind, string> = {
  login: 'Open your Radix Wallet app to login',
  data: 'Open your Radix Wallet app to review the request',
  transaction: 'Open your Radix Wallet app to review the transaction',
  preAuthorization:
    'Open your Radix Wallet app to review the pre-authorization',
  request: 'Open your Radix Wallet app to review the request',
}

const walletNotConnectedMessage =
  "Your Radix Wallet isn't connected — open the app on your phone to receive this request"

/** Title and text of a dApp request's notification. */
export const requestNotificationContent = (
  kind: RequestKind,
  walletConnected: boolean,
) => ({
  title: requestTitles[kind] ?? requestTitles.request,
  message: walletConnected
    ? reviewMessages[kind] ?? reviewMessages.request
    : walletNotConnectedMessage,
})

/** A callback-style chrome.notifications call, as a `ResultAsync`. */
const call = (
  what: string,
  fn: (callback: (result: boolean) => void) => void,
): ResultAsync<boolean, Error> =>
  ResultAsync.fromPromise(
    new Promise<boolean>((resolve, reject) => {
      fn((result) => {
        const lastError = chrome.runtime.lastError
        if (lastError) reject(new Error(lastError.message))
        else resolve(result)
      })
    }),
    (error) =>
      new Error(`${what}: ${error instanceof Error ? error.message : error}`),
  )

export const notificationDispatcher = {
  /**
   * The notification of a dApp request (decided by the offscreen document, which
   * knows whether its wallet is connected): shown once, its text changed once the
   * wallet connects, removed once the request is over.
   */
  request: ({
    action,
    interactionId,
    kind,
    walletConnected,
  }: RequestNotification): ResultAsync<unknown, Error> => {
    const id = requestNotificationId(interactionId)
    if (action === 'clear')
      return call('clearing a request notification', (callback) =>
        chrome.notifications.clear(id, callback),
      )
    const content = requestNotificationContent(kind, walletConnected)
    if (action === 'update')
      // Does nothing if the user already closed it: never shown again.
      return call('updating a request notification', (callback) =>
        chrome.notifications.update(id, content, callback),
      )
    return getShowDAppRequestNotifications().andThen((show) =>
      show
        ? createNotification(id, content.title, content.message)
        : okAsync(undefined),
    )
  },
  /** A wallet deleted its link with this extension, which forgot it too. */
  linkRemoved: (walletName: string) =>
    createNotification(
      linkRemovedNotificationId(),
      'Wallet unlinked',
      `${walletName} removed this connector, so it was forgotten here too.`,
    ),
  transaction: (networkId: number, txId: string, status: TransactionStatus) => {
    getShowTransactionResultNotifications().map(
      (showTransactionResultNotifications) => {
        if (!showTransactionResultNotifications) {
          return
        }

        const title =
          status === 'CommittedSuccess'
            ? 'Transaction Successful'
            : 'Transaction Failed'

        createNotification(
          transactionNotificationId(networkId, txId),
          title,
          'View more info on the Radix Dashboard',
          [
            {
              title: 'View',
            },
          ],
        )
      },
    )
  },
}
