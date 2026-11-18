import type { AppLogger } from 'utils/logger'
import { globalTimers, type Timers } from 'utils/timers'
import {
  isFinalStatus,
  type PendingRequest,
  type RequestKind,
  type RequestStatus,
  type RequestOutcome,
  type RequestOutcomes,
} from './pending-request'
import { activeStatusOf, mayMove } from './request-lifecycle'
import { DAppTurns } from './dapp-turns'
import { WalletPresence } from './wallet-presence'

/**
 * What to do with the desktop notification of a request: show it, change its text
 * once the wallet connected, or remove it once the request is over.
 */
export type RequestNotification = {
  action: 'create' | 'update' | 'clear'
  interactionId: string
  kind: RequestKind
  walletConnected: boolean
}

type Entry = Omit<PendingRequest, 'wallets'> & {
  /** Links (short wallet keys) that queued it and may still send it. */
  holders: Set<string>
  delivered: boolean
  /** The link (short wallet key) whose wallet received it. */
  deliveredTo?: string
  /** When that wallet confirmed it. */
  deliveredAt?: number
  /** Links sending it right now: it holds its dApp's turn meanwhile. */
  sendingBy: Set<string>
  /** The wallet that received it was away long enough to have been closed. */
  walletLost?: boolean
  walletLostTimer?: unknown
  /** What the notification says, once there is one. */
  notified?: 'waiting' | 'connected'
  notifyTimer?: unknown
}

/**
 * The dApp requests of the offscreen document and their status, across the links
 * (a request without a session goes to every linked wallet; the first one that
 * receives it wins). Only origins, kinds, statuses and times: never contents.
 * A request's status follows from what is known of it (`request-lifecycle`), its
 * dApp's turns (`dapp-turns`) and its wallet (`wallet-presence`).
 *
 * - `onChange` gets the list after every change (for the popup): the requests
 *   still going on. One that is over (answered, cancelled, not delivered) leaves
 *   it at once, so that its card goes away,
 * - `onNotification` decides the request's single desktop notification: created
 *   `notifyDelayMs` after the request arrived (once the links queued it), changed
 *   once when a wallet connects to a request notified as waiting, removed when the
 *   request is over. A link that flaps never changes it back.
 * - a request in a wallet whose link stays down `walletLostAfterMs` becomes
 *   `walletDisconnected`, and stays so when the link comes back: the wallet may
 *   have been closed, losing it, or only gone to the background, keeping it;
 *   the extension cannot tell. A shorter drop (the network) changes nothing.
 */
/** How long a finished request's outcome is kept for its card to leave. */
const OUTCOME_KEPT_MS = 5_000

export const RequestTracker = ({
  onChange,
  onNotification,
  logger,
  now = Date.now,
  notifyDelayMs = 300,
  walletLostAfterMs = 5_000,
  walletLostAfterProbedMs = 2_000,
  timers = globalTimers,
}: {
  onChange?: (requests: PendingRequest[], outcomes: RequestOutcomes) => void
  onNotification?: (notification: RequestNotification) => void
  logger?: AppLogger
  now?: () => number
  notifyDelayMs?: number
  walletLostAfterMs?: number
  /**
   * The same for a wallet that reports its requests (iroh): its link going down was
   * already checked (the library probes a wallet in the background), so less is waited.
   */
  walletLostAfterProbedMs?: number
  timers?: Pick<Timers, 'setTimeout' | 'clearTimeout'>
} = {}) => {
  const entries = new Map<string, Entry>()
  const presence = WalletPresence()

  const toRequest = (entry: Entry): PendingRequest => {
    const wallet = entry.deliveredTo
    return {
      interactionId: entry.interactionId,
      origin: entry.origin,
      kind: entry.kind,
      status: entry.status,
      wallets: wallet ? [wallet] : [...entry.holders],
      delivered: entry.delivered,
      ...(entry.turnAt !== undefined && { turnAt: entry.turnAt }),
      ...(entry.status === 'deliveredToWallet' &&
        wallet &&
        presence.inBackground(wallet) && { walletInBackground: true }),
      ...(entry.status === 'walletDisconnected' &&
        wallet &&
        presence.reportsRequests(wallet) && { comesBack: true }),
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    }
  }

  /** Newest first. */
  const list = (): PendingRequest[] =>
    [...entries.values()]
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(toRequest)

  /** Whether a lost request comes back by itself: its wallet reports what it holds. */
  const comesBack = (entry: Entry) =>
    presence.reportsRequests(entry.deliveredTo)

  const turns = DAppTurns<Entry>(comesBack)
  const waitsForTurn = (entry: Entry) =>
    turns.waitsForTurn(entry, entries.values())

  /**
   * Whether `link` must not send the request now, besides its dApp's turn. A request
   * goes into one wallet only, the first one the person opens: not to a wallet whose
   * app said it is in the background (it goes once the app comes back), nor while
   * another link is sending it, nor once another wallet has it. A wallet that never
   * says where its app is (the official one, over WebRTC) gets it as soon as it is
   * connected, as before.
   */
  const heldFrom = (entry: Entry, link: string | undefined) => {
    if (!link) return false
    if (entry.delivered && entry.deliveredTo && entry.deliveredTo !== link)
      return true
    if ([...entry.sendingBy].some((other) => other !== link)) return true
    return presence.inBackground(link)
  }

  /** Called after every change: the links' queues look again at what may go. */
  const turnListeners = new Set<() => void>()

  const changed = () => {
    // One request's change may give, or take, the turn of others of its dApp.
    for (const entry of entries.values()) refresh(entry)
    onChange?.(list(), recentOutcomes())
    for (const listener of turnListeners) listener()
  }

  const notify = (entry: Entry, action: RequestNotification['action']) =>
    onNotification?.({
      action,
      interactionId: entry.interactionId,
      kind: entry.kind,
      walletConnected: entry.status !== 'waitingForWallet',
    })

  const activeStatus = (entry: Entry): RequestStatus =>
    activeStatusOf({
      delivered: entry.delivered,
      walletLost: !!entry.walletLost,
      waitsForTurn: waitsForTurn(entry),
      holderConnected: presence.anyConnected(entry.holders),
    })

  /** Sets the status and keeps the notification in step with it. */
  const setStatus = (entry: Entry, status: RequestStatus) => {
    if (entry.status === status) return false
    const previous = entry.status
    // Never expected (see `requestTransitions`): a mistake in what the links tell.
    if (!mayMove(previous, status))
      logger?.warn('dApp request: unexpected status change', {
        interactionId: entry.interactionId,
        from: previous,
        to: status,
      })
    entry.status = status
    entry.updatedAt = now()
    // Its turn came: what it waited for an earlier request does not count against it.
    if (previous === 'waitingForTurn' && !isFinalStatus(status))
      entry.turnAt = entry.updatedAt
    logger?.info('dApp request status', {
      interactionId: entry.interactionId,
      kind: entry.kind,
      from: previous,
      to: status,
    })
    if (isFinalStatus(status)) {
      if (entry.notifyTimer !== undefined)
        timers.clearTimeout(entry.notifyTimer)
      entry.notifyTimer = undefined
      stopWatchingWallet(entry)
      if (entry.notified) notify(entry, 'clear')
      entry.notified = undefined
    } else if (entry.notified === 'waiting' && status !== 'waitingForWallet') {
      entry.notified = 'connected'
      notify(entry, 'update')
    }
    return true
  }

  const stopWatchingWallet = (entry: Entry) => {
    if (entry.walletLostTimer !== undefined)
      timers.clearTimeout(entry.walletLostTimer)
    entry.walletLostTimer = undefined
  }

  /** The link of the wallet that has it went down: lost, unless it comes back soon. */
  const watchWallet = (entry: Entry) => {
    if (entry.walletLost || entry.walletLostTimer !== undefined) return
    entry.walletLostTimer = timers.setTimeout(
      () => {
        entry.walletLostTimer = undefined
        if (isFinalStatus(entry.status) || !entry.delivered) return
        if (entry.deliveredTo && presence.isConnected(entry.deliveredTo)) return
        entry.walletLost = true
        logger?.info(
          'dApp request: its wallet disconnected without answering',
          {
            interactionId: entry.interactionId,
          },
        )
        if (refresh(entry)) changed()
      },
      presence.reportsRequests(entry.deliveredTo)
        ? walletLostAfterProbedMs
        : walletLostAfterMs,
    )
  }

  const refresh = (entry: Entry) => {
    if (isFinalStatus(entry.status)) return false
    return setStatus(entry, activeStatus(entry))
  }

  /** How the requests over in the last few seconds ended, and when. */
  const outcomes = new Map<string, { outcome: RequestOutcome; at: number }>()
  const recentOutcomes = (): RequestOutcomes => {
    const since = now() - OUTCOME_KEPT_MS
    for (const [id, { at }] of outcomes) if (at < since) outcomes.delete(id)
    return Object.fromEntries(
      [...outcomes].map(([id, { outcome }]) => [id, outcome]),
    )
  }

  /** The request is over: its notification goes, and it leaves the list. */
  const finish = (
    interactionId: string,
    status: RequestStatus,
    outcome: RequestOutcome = 'rejected',
  ) => {
    const entry = entries.get(interactionId)
    if (!entry || isFinalStatus(entry.status)) return
    setStatus(entry, status)
    entries.delete(interactionId)
    outcomes.set(interactionId, { outcome, at: now() })
    changed()
  }

  return {
    /** A link queued the request for its wallet. */
    track: (
      interactionId: string,
      details: { origin: string; kind: RequestKind },
      link: string,
    ) => {
      let entry = entries.get(interactionId)
      if (!entry || isFinalStatus(entry.status)) {
        const time = now()
        entry = {
          interactionId,
          origin: details.origin,
          kind: details.kind,
          status: 'waitingForWallet',
          createdAt: time,
          updatedAt: time,
          holders: new Set(),
          sendingBy: new Set(),
          delivered: false,
        }
        entries.set(interactionId, entry)
        const created = entry
        created.notifyTimer = timers.setTimeout(() => {
          created.notifyTimer = undefined
          if (isFinalStatus(created.status) || created.notified) return
          created.notified =
            created.status === 'waitingForWallet' ? 'waiting' : 'connected'
          notify(created, 'create')
        }, notifyDelayMs)
        logger?.info('dApp request tracked', {
          interactionId,
          kind: details.kind,
          origin: details.origin,
        })
      }
      entry.holders.add(link)
      refresh(entry)
      changed()
    },
    /** A link connected to, or lost, its wallet. */
    linkConnected: (link: string, connected: boolean) => {
      presence.setConnected(link, connected)
      let anyChanged = false
      for (const entry of entries.values()) {
        if (
          entry.delivered &&
          entry.deliveredTo === link &&
          !isFinalStatus(entry.status)
        ) {
          if (connected) {
            stopWatchingWallet(entry)
            // Back, and it tells which requests it has: it kept this one, or gets it again
            // by itself (`redelivered`). Either way it is in the wallet.
            if (entry.walletLost && presence.reportsRequests(link)) {
              entry.walletLost = false
              anyChanged = refresh(entry) || anyChanged
            }
          } else watchWallet(entry)
        }
        if (entry.holders.has(link)) anyChanged = refresh(entry) || anyChanged
      }
      if (anyChanged) changed()
    },
    /**
     * `link` is about to send the request: whether it may, now. It may not while an
     * earlier request of its dApp is being sent or is in a wallet; if it may, it holds
     * its dApp's turn until `sendingEnded`. A request not tracked goes.
     */
    takeTurn: (interactionId: string, link: string) => {
      const entry = entries.get(interactionId)
      if (!entry || isFinalStatus(entry.status)) return true
      if (waitsForTurn(entry) || heldFrom(entry, link)) return false
      entry.sendingBy.add(link)
      changed()
      return true
    },
    /** Whether a queued request may be sent now by `link` (see `takeTurn`). */
    mayGo: (interactionId: string, link?: string) => {
      const entry = entries.get(interactionId)
      return (
        !entry ||
        isFinalStatus(entry.status) ||
        (!waitsForTurn(entry) && !heldFrom(entry, link))
      )
    },
    /** `link` is no longer sending it: delivered, or not. */
    sendingEnded: (interactionId: string, link: string) => {
      const entry = entries.get(interactionId)
      if (!entry?.sendingBy.delete(link)) return
      changed()
    },
    /** Calls `listener` after every change; returns how to stop. */
    onTurnChange: (listener: () => void) => {
      turnListeners.add(listener)
      return () => {
        turnListeners.delete(listener)
      }
    },
    /** A wallet confirmed it received the request. */
    delivered: (interactionId: string, link?: string) => {
      const entry = entries.get(interactionId)
      if (!entry || isFinalStatus(entry.status)) return
      entry.delivered = true
      entry.deliveredAt = now()
      if (link) entry.deliveredTo = link
      if (refresh(entry)) changed()
    },
    /** A link no longer sends it (delivered by another one, or it gave up). */
    released: (interactionId: string, link: string, gaveUp = false) => {
      const entry = entries.get(interactionId)
      if (!entry || isFinalStatus(entry.status)) return
      entry.holders.delete(link)
      if (gaveUp && !entry.delivered && entry.holders.size === 0)
        return finish(interactionId, 'failed')
      if (refresh(entry)) changed()
    },
    /**
     * A link's wallet: whether it reports the requests it holds (asked when needed),
     * and whether its app is in the background.
     */
    walletOf: presence.walletOf,
    walletInBackground: (link: string, inBackground: boolean) => {
      if (!presence.setInBackground(link, inBackground)) return
      // Its status changes, or it may now send what it held back.
      if (
        [...entries.values()].some(
          (entry) => entry.deliveredTo === link || entry.holders.has(link),
        )
      )
        changed()
    },
    /**
     * `link`'s wallet app was closed (iroh saw it): a request in it is lost now, not
     * after `walletLostAfterProbedMs`.
     */
    walletClosed: (link: string) => {
      let anyChanged = false
      for (const entry of entries.values()) {
        if (
          !entry.delivered ||
          entry.deliveredTo !== link ||
          isFinalStatus(entry.status) ||
          entry.walletLost
        )
          continue
        stopWatchingWallet(entry)
        entry.walletLost = true
        logger?.info(
          'dApp request: its wallet app was closed without answering',
          {
            interactionId: entry.interactionId,
          },
        )
        anyChanged = refresh(entry) || anyChanged
      }
      if (anyChanged) changed()
    },
    /**
     * The link delivered it again by itself: its wallet had lost it with its app, and
     * has it again.
     */
    redelivered: (interactionId: string, link: string) => {
      const entry = entries.get(interactionId)
      if (!entry || isFinalStatus(entry.status)) return
      stopWatchingWallet(entry)
      entry.delivered = true
      entry.deliveredTo = link
      entry.deliveredAt = now()
      entry.walletLost = false
      logger?.info(
        'dApp request delivered again to a wallet that had lost it',
        {
          interactionId,
        },
      )
      refresh(entry)
      changed()
    },
    /**
     * `link`'s wallet listed the requests it still has, on a connection opened at `since`
     * (WebRTC). Returns those it lost: delivered to it before that connection, and not
     * listed. One it lists is in the wallet, even after its link went down.
     */
    heldBy: (link: string, interactionIds: string[], since: number) => {
      const held = new Set(interactionIds)
      const lost: string[] = []
      let anyChanged = false
      for (const entry of entries.values()) {
        if (isFinalStatus(entry.status) || !entry.delivered) continue
        if (entry.deliveredTo !== link) continue
        if (held.has(entry.interactionId)) {
          if (entry.walletLost) {
            entry.walletLost = false
            anyChanged = refresh(entry) || anyChanged
          }
        } else if ((entry.deliveredAt ?? 0) < since) {
          lost.push(entry.interactionId)
        }
      }
      if (anyChanged) changed()
      return lost
    },
    /** Queued again for `link`, after its wallet disconnected without answering. */
    resent: (interactionId: string, link: string) => {
      const entry = entries.get(interactionId)
      if (!entry || isFinalStatus(entry.status)) return
      stopWatchingWallet(entry)
      entry.delivered = false
      entry.deliveredTo = undefined
      entry.walletLost = false
      entry.holders.add(link)
      if (refresh(entry)) changed()
    },
    /** Its wallet answered it: `accepted` when it approved it. */
    answered: (interactionId: string, accepted = false) =>
      finish(interactionId, 'answered', accepted ? 'accepted' : 'rejected'),
    cancelled: (interactionId: string) => finish(interactionId, 'cancelled'),
    get: (interactionId: string) => {
      const entry = entries.get(interactionId)
      return entry ? toRequest(entry) : undefined
    },
    list,
  }
}

export type RequestTracker = ReturnType<typeof RequestTracker>
