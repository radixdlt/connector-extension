import { isFinalStatus, type RequestStatus } from './pending-request'

/** What the turns of a dApp look at in each of its requests. */
export type TurnEntry = {
  interactionId: string
  origin: string
  createdAt: number
  status: RequestStatus
  delivered: boolean
  /** Links sending it right now. */
  sendingBy: ReadonlySet<string>
  walletLost?: boolean
}

/**
 * One request of a dApp at a time: a wallet shows one at a time, and one it holds can
 * no longer be cancelled from here. `comesBack` tells whether a lost request comes
 * back by itself (its wallet reports what it holds).
 */
export const DAppTurns = <Entry extends TurnEntry>(
  comesBack: (entry: Entry) => boolean,
) => {
  /** Queued before: by when it was tracked, then by id, so that two never tie. */
  const isEarlier = (a: Entry, b: Entry) =>
    a.createdAt < b.createdAt ||
    (a.createdAt === b.createdAt && a.interactionId < b.interactionId)

  /**
   * Whether `entry` holds its dApp's turn: being sent, or in a wallet (one that lost it
   * for good does not hold it).
   */
  const holdsTurn = (entry: Entry) =>
    !isFinalStatus(entry.status) &&
    (entry.sendingBy.size > 0 ||
      (entry.delivered && !(entry.walletLost && !comesBack(entry))))

  /**
   * Whether `entry`, not sent yet, waits for an earlier request of its dApp among
   * `entries`: one that holds the turn, or one queued before it that is not sent yet
   * either. A dApp's line is strictly in order: when the request holding the turn is
   * over, only the next one may go, never all of them for a moment.
   */
  const waitsForTurn = (entry: Entry, entries: Iterable<Entry>) =>
    !entry.delivered &&
    entry.sendingBy.size === 0 &&
    [...entries].some(
      (other) =>
        other !== entry &&
        other.origin === entry.origin &&
        !isFinalStatus(other.status) &&
        (holdsTurn(other) || (!other.delivered && isEarlier(other, entry))),
    )

  return { holdsTurn, waitsForTurn }
}
