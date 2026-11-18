/**
 * What the extension shows about a dApp request: where it comes from, its kind, its
 * status and when. Never its contents (manifests, accounts, persona data).
 */
export type RequestKind =
  | 'login'
  | 'data'
  | 'transaction'
  | 'preAuthorization'
  | 'request'

export type RequestStatus =
  /** Queued: no wallet that may answer it is connected. */
  | 'waitingForWallet'
  /** Queued, a wallet is connected: being sent. */
  | 'sending'
  /**
   * Queued behind an earlier request of the same dApp, which is being sent or is in a
   * wallet: a wallet shows one request at a time, and one it holds can no longer be
   * cancelled from here. It goes once that one is over.
   */
  | 'waitingForTurn'
  /** The wallet confirmed it received it. */
  | 'deliveredToWallet'
  /**
   * The wallet that received it disconnected before answering, long enough to
   * have been closed: it may no longer have it (it keeps requests in memory),
   * and only the user knows. It can be sent again, or cancelled.
   */
  | 'walletDisconnected'
  | 'answered'
  | 'cancelled'
  /** Could not be delivered: the extension gave up. */
  | 'failed'

export type PendingRequest = {
  interactionId: string
  /** The dApp's host name, e.g. `dashboard.radixdlt.com`. */
  origin: string
  kind: RequestKind
  status: RequestStatus
  /**
   * The linked wallets it is queued for, by short wallet key: one for a request of
   * a dApp session, every linked wallet otherwise.
   */
  wallets: string[]
  /** Whether a wallet received it: then `wallets` is that one. */
  delivered: boolean
  /** In a wallet whose app is in the background, as the wallet said. */
  walletInBackground?: boolean
  /**
   * `walletDisconnected` in a wallet that tells which requests it still has when it is
   * back: if it lost this one, it is delivered again by itself.
   */
  comesBack?: boolean
  /** Milliseconds since the epoch. */
  createdAt: number
  /**
   * When it got its turn: `createdAt`, unless it waited for an earlier request of its
   * dApp. What its expiry counts from.
   */
  turnAt?: number
  updatedAt: number
}

export type PendingRequestsResponse = { requests: PendingRequest[] }

/**
 * How a request just over ended, for its card to leave the right way: `accepted` (its
 * wallet approved it) or `rejected` (rejected or failed in the wallet, cancelled here
 * or by its dApp, or never delivered). By interaction id, for a few seconds.
 */
export type RequestOutcome = 'accepted' | 'rejected'
export type RequestOutcomes = Record<string, RequestOutcome>

export const finalRequestStatuses: readonly RequestStatus[] = [
  'answered',
  'cancelled',
  'failed',
]

export const isFinalStatus = (status: RequestStatus) =>
  finalRequestStatuses.includes(status)

type RequestItems = {
  discriminator?: string
  auth?: { discriminator?: string }
}

/** The kind of a dApp request, from its items' discriminators only. */
export const requestKindOf = (items: RequestItems | undefined): RequestKind => {
  switch (items?.discriminator) {
    case 'transaction':
      return 'transaction'
    case 'preAuthorizationRequest':
      return 'preAuthorization'
    case 'unauthorizedRequest':
      return 'data'
    case 'authorizedRequest':
      return items.auth?.discriminator === 'usePersona' ? 'data' : 'login'
    default:
      return 'request'
  }
}

/** The host name of a dApp origin (the origin itself if it is not a URL). */
export const originHostOf = (origin: unknown) => {
  const text = typeof origin === 'string' ? origin : ''
  try {
    return new URL(text).hostname || text.slice(0, 100)
  } catch (error) {
    return text.slice(0, 100)
  }
}

/** After how long a pending request no wallet is answering is cancelled. */
export type PendingRequestExpiry = '2m' | '5m' | '15m' | 'never'

export const defaultPendingRequestExpiry: PendingRequestExpiry = '5m'

export const pendingRequestExpiryMs: Record<
  PendingRequestExpiry,
  number | undefined
> = {
  '2m': 2 * 60_000,
  '5m': 5 * 60_000,
  '15m': 15 * 60_000,
  never: undefined,
}

/**
 * The requests to cancel at `now`, older than `expiry`: those no wallet has (waiting
 * for one, or not getting through to it), and those a wallet lost with its app when it
 * does not get them back by itself. Never one in a wallet: the person may be approving
 * it, and the wallet would show what could no longer reach the dApp.
 */
export const expiredRequests = (
  requests: PendingRequest[],
  expiry: PendingRequestExpiry,
  now: number,
): PendingRequest[] => {
  const ms = pendingRequestExpiryMs[expiry]
  if (ms === undefined) return []
  return requests.filter((request) => {
    if (now - (request.turnAt ?? request.createdAt) < ms) return false
    switch (request.status) {
      case 'waitingForWallet':
      case 'sending':
        return true
      case 'walletDisconnected':
        return !request.comesBack
      default:
        return false
    }
  })
}
