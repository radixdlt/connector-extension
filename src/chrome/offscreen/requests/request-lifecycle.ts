import type { RequestStatus } from './pending-request'

/** What is known of a request going on, from which its status follows. */
export type RequestFacts = {
  /** A wallet confirmed it received it. */
  delivered: boolean
  /** That wallet was away long enough to have been closed. */
  walletLost: boolean
  /** It waits for an earlier request of its dApp (see `waitsForTurn`). */
  waitsForTurn: boolean
  /** One of the links that may send it is connected to its wallet. */
  holderConnected: boolean
}

/** The status of a request going on. */
export const activeStatusOf = (facts: RequestFacts): RequestStatus => {
  if (facts.delivered)
    return facts.walletLost ? 'walletDisconnected' : 'deliveredToWallet'
  if (facts.waitsForTurn) return 'waitingForTurn'
  return facts.holderConnected ? 'sending' : 'waitingForWallet'
}

const queued = ['waitingForWallet', 'sending', 'waitingForTurn'] as const

/**
 * The statuses a request may move to from each: among the queued ones as wallets
 * connect and turns change, to a wallet once one received it, and out of it again
 * only when it is sent again (`resent`). One over moves no more.
 */
export const requestTransitions: Record<
  RequestStatus,
  readonly RequestStatus[]
> = {
  waitingForWallet: [
    ...queued,
    'deliveredToWallet',
    'answered',
    'cancelled',
    'failed',
  ],
  sending: [...queued, 'deliveredToWallet', 'answered', 'cancelled', 'failed'],
  waitingForTurn: [
    ...queued,
    'deliveredToWallet',
    'answered',
    'cancelled',
    'failed',
  ],
  deliveredToWallet: [...queued, 'walletDisconnected', 'answered', 'cancelled'],
  walletDisconnected: [...queued, 'deliveredToWallet', 'answered', 'cancelled'],
  answered: [],
  cancelled: [],
  failed: [],
}

/** Whether a request may move from `from` to `to` (see `requestTransitions`). */
export const mayMove = (from: RequestStatus, to: RequestStatus) =>
  requestTransitions[from].includes(to)
