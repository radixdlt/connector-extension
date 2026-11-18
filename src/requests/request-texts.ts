import {
  isFinalStatus,
  type PendingRequest,
  type RequestKind,
  type RequestStatus,
} from 'chrome/offscreen/requests/pending-request'
import { formatDuration } from 'options/diagnostics-report'

export const requestKindLabels: Record<RequestKind, string> = {
  login: 'Login',
  data: 'Data request',
  transaction: 'Transaction',
  preAuthorization: 'Pre-authorization',
  request: 'Request',
}

export const requestStatusLabels: Record<RequestStatus, string> = {
  // Short, so the time fits beside it; the banner below says what to do.
  waitingForWallet: 'Waiting for the wallet',
  sending: 'Sending to the wallet',
  waitingForTurn: 'Waiting for its turn',
  deliveredToWallet: 'In your Radix Wallet',
  walletDisconnected: 'Wallet disconnected',
  answered: 'Answered',
  cancelled: 'Cancelled',
  failed: "Couldn't reach the wallet",
}

export const walletNotConnectedBanner =
  'Open the Radix Wallet app on your phone to continue'

export const walletDisconnectedNotice = {
  title: 'Your Radix Wallet disconnected without answering',
  text: 'If you closed the app, send it again. If not, open the wallet: the request is still there.',
}

/** The same, for a wallet that tells which requests it still has when it is back. */
export const walletComesBackNotice = {
  title: 'Your Radix Wallet disconnected without answering',
  text: 'Open the wallet: if it lost the request, it is sent again by itself.',
}

/** In a wallet whose app is in the background: short, so the time fits beside it. */
export const walletInBackgroundLabel = 'Wallet in the background'

/** What a card says while its cancel, or its sending again, is under way. */
export const CANCELLING = 'Cancelling…'
export const SENDING_AGAIN = 'Sending it again…'

/** What a request's status line says. */
export const statusLabel = (request: PendingRequest) =>
  request.walletInBackground
    ? walletInBackgroundLabel
    : requestStatusLabels[request.status]

/**
 * Requests the extension can still take back: not in the wallet yet, or in a
 * wallet that disconnected without answering.
 */
export const isCancellable = (request: PendingRequest) =>
  request.status === 'waitingForWallet' ||
  request.status === 'sending' ||
  request.status === 'waitingForTurn' ||
  request.status === 'walletDisconnected'

/** First what needs the user, then what is under way, then what is over. */
export const attentionOrder: Record<RequestStatus, number> = {
  walletDisconnected: 0,
  waitingForWallet: 0,
  sending: 1,
  waitingForTurn: 1,
  deliveredToWallet: 1,
  failed: 2,
  answered: 2,
  cancelled: 2,
}

export const byAttention = (a: PendingRequest, b: PendingRequest) =>
  attentionOrder[a.status] - attentionOrder[b.status] ||
  b.createdAt - a.createdAt

/** The status words of the cards with a footer. */
export const footerStatuses = new Set<string>([
  requestStatusLabels.waitingForWallet,
  requestStatusLabels.walletDisconnected,
])

/** Whether a request's card has a footer: what to do while it waits. */
export const hasFooter = (request: PendingRequest) =>
  request.status === 'waitingForWallet' ||
  request.status === 'walletDisconnected'

/** How long it has waited, beside a clock; or how long ago it ended. */
export const elapsed = (request: PendingRequest, now: number) =>
  isFinalStatus(request.status)
    ? `${formatDuration(Math.max(now - request.updatedAt, 0))} ago`
    : formatDuration(Math.max(now - request.createdAt, 0))

/**
 * Who the request is for: the wallet that received it, else every wallet it
 * may go to, by name (a request without a dApp session goes to all of them).
 * `walletNames`: the names of the linked wallets, by short wallet key.
 */
export const recipientOf = (
  request: PendingRequest,
  walletNames: Record<string, string>,
) => {
  const names = request.wallets
    .map((wallet) => walletNames[wallet])
    .filter(Boolean)
  if (!names.length) return undefined
  if (request.delivered) return `Sent to ${names[0]}`
  if (names.length === 1) return `For ${names[0]}`
  const shown = names.length > 3 ? names.slice(0, 2) : names.slice(0, -1)
  const last =
    names.length > 3 ? `${names.length - 2} more` : names[names.length - 1]
  return `For ${shown.join(', ')} or ${last}`
}
