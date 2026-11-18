import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { config } from 'config'
import {
  isFinalStatus,
  type PendingRequest,
  type RequestOutcomes,
} from 'chrome/offscreen/requests/pending-request'
import { useConnectionsClient } from 'pairing/state/connections'
import { shortWalletKey } from 'chrome/offscreen/wallet-connection/transport/diagnostics'
import {
  cancelPendingRequest,
  resendPendingRequest,
  usePendingRequests,
} from './pending-requests-client'
import { Collapse } from 'ui/collapse'
import { CANCELLING, SENDING_AGAIN } from './request-texts'
import { layoutOf, withGoneAtPlaces } from './request-layout'
import {
  BeforeCommit,
  SPREAD_LEAVE_MS,
  SWAP_MS,
  useClosingSection,
  useLaterRunner,
  useLayoutMotion,
  useLeavingItems,
  useLeavingQueued,
  useLeavingFooters,
  useLeavingTops,
  useNow,
} from './request-motion'
import { CountBadge, requestCard, type CardContext } from './request-card'
import './pending-requests.css'

/**
 * The dApp requests of the wallet links, while there are any: each a card of its
 * kind and origin, its status and time, and the wallets it is for (never its
 * contents); a banner when one waits for a wallet that is not connected, or when
 * its wallet disconnected without answering, with a way to send it again; and a
 * way to cancel one the wallet no longer has, at the top right of its card. Those
 * that need the user come first.
 */
export const PendingRequestsView = ({
  requests,
  onCancel = (interactionId) =>
    cancelPendingRequest(interactionId, config.diagnostics.requestTimeout),
  onResend = (interactionId) =>
    resendPendingRequest(interactionId, config.diagnostics.requestTimeout),
  walletNames = {},
  outcomes = {},
}: {
  requests: PendingRequest[]
  onCancel?: (interactionId: string) => ReturnType<typeof cancelPendingRequest>
  onResend?: (interactionId: string) => ReturnType<typeof resendPendingRequest>
  /** The names of the linked wallets, by short wallet key. */
  walletNames?: Record<string, string>
  /** How the requests just over ended: an accepted one leaves to the left. */
  outcomes?: RequestOutcomes
}) => {
  const now = useNow(requests.length > 0)
  const [notes, setNotes] = useState<Record<string, string>>({})
  // Each dApp's requests waiting for their turn lie, folded, under its card; by origin,
  // whether they are shown.
  const [openDecks, setOpenDecks] = useState<Record<string, boolean>>({})
  const layout = useMemo(() => layoutOf(requests), [requests])
  const leaving = useLeavingTops(layout)
  const leavingItems = useLeavingItems(layout)
  const { leaving: leavingQueued, arriving: arrivingQueued } =
    useLeavingQueued(layout)
  const later = useLaterRunner()
  const footersGoing = useLeavingFooters(requests)
  // The notes of requests gone, once their cards have left.
  useEffect(() => {
    const present = new Set(requests.map((request) => request.interactionId))
    const gone = Object.keys(notes).filter((id) => !present.has(id))
    if (!gone.length) return
    later(
      () =>
        setNotes((current) =>
          Object.fromEntries(
            Object.entries(current).filter(([id]) => !gone.includes(id)),
          ),
        ),
      SPREAD_LEAVE_MS + SWAP_MS,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requests])
  const sectionRef = useRef<HTMLElement>(null)
  // What each card said last: its status fades in only when it changes on the same card
  // (a card appearing, leaving or moving keeps its words as they are).
  const shownStatus = useRef(new Map<string, string>())
  const statusesNow = new Map<string, string>()
  useLayoutEffect(() => {
    shownStatus.current = statusesNow
  })
  // Shown as they are when the panel opens; only what changes after moves.
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    if (settled || !requests.length) return
    const frame = requestAnimationFrame(() => setSettled(true))
    return () => cancelAnimationFrame(frame)
  }, [settled, requests.length])
  // The cards already there when it settles do not start to move then: only what
  // changes afterwards does (they faded in a moment after the panel opened).
  useLayoutEffect(() => {
    const root = sectionRef.current
    if (!settled || typeof root?.getAnimations !== 'function') return
    root
      .getAnimations({ subtree: true })
      .forEach((animation) => animation.finish())
  }, [settled])
  // What the list shows; a render with the same is not a change.
  const changeKey = [
    requests.map((r) => `${r.interactionId}:${r.status}`).join(','),
    Object.values(leaving)
      .flat()
      .map((r) => r.interactionId)
      .join(','),
    leavingItems.map((item) => item.key).join(','),
    Object.values(leavingQueued)
      .flat()
      .map((item) => item.request.interactionId)
      .join(','),
    Object.entries(openDecks)
      .filter(([, open]) => open)
      .map(([origin]) => origin)
      .join(','),
    Object.values(notes).join(','),
  ].join('|')
  const snapshot = useLayoutMotion(sectionRef, settled, changeKey)

  // Emptying: the last card leaves, then the section closes (see useClosingSection).
  const emptying = !requests.length && leavingItems.length > 0
  useClosingSection(sectionRef, emptying)

  if (!requests.length && !emptying) return null

  const cancel = (request: PendingRequest) => {
    setNotes((current) => ({
      ...current,
      [request.interactionId]: CANCELLING,
    }))
    onCancel(request.interactionId).match(
      ({ cancelled }) =>
        setNotes((current) => ({
          ...current,
          // Cancelled: it says so until its card has gone (brightening again on its
          // way out was a flash); its note is dropped after.
          [request.interactionId]: cancelled
            ? CANCELLING
            : 'Already in your Radix Wallet: reject it there',
        })),
      () =>
        setNotes((current) => ({
          ...current,
          [request.interactionId]: 'Could not cancel it',
        })),
    )
  }

  const resend = (request: PendingRequest) => {
    setNotes((current) => ({
      ...current,
      [request.interactionId]: SENDING_AGAIN,
    }))
    onResend(request.interactionId).match(
      ({ resent }) =>
        setNotes((current) => ({
          ...current,
          [request.interactionId]: resent ? '' : 'Could not send it again',
        })),
      () =>
        setNotes((current) => ({
          ...current,
          [request.interactionId]: 'Could not send it again',
        })),
    )
  }

  /** A card on its way out: to the left when its wallet approved it, else right. */
  const leavingClasses = (request: PendingRequest) =>
    `request-card--leaving request-card--hidden${
      outcomes[request.interactionId] === 'accepted'
        ? ' request-card--accepted'
        : ''
    }`

  const cardContext: CardContext = {
    notes,
    said: shownStatus.current,
    saying: statusesNow,
    now,
    walletNames,
    cancel,
    resend,
    footersGoing,
  }
  /** One request's card; `extra`: classes for how it moves. */
  const card = (request: PendingRequest, extra = '') =>
    requestCard(request, extra, cardContext)

  const { decks, shown } = layout

  /**
   * A dApp's card on top: when the one before it just went (answered, cancelled), that
   * one leaves upwards, drawn over it, while this one comes up from the deck.
   */
  const topCard = (top: PendingRequest) => {
    const before = leaving[top.origin] ?? []
    return (
      <>
        {before.map((going) => (
          <div
            key={`leaving:${going.interactionId}`}
            className={`request-swap__leaving${
              outcomes[going.interactionId] === 'accepted'
                ? ' request-swap__leaving--accepted'
                : ''
            }`}
            aria-hidden="true"
          >
            {card(going, leavingClasses(going))}
          </div>
        ))}
        {card(top, before.length ? 'request-card--arriving' : '')}
      </>
    )
  }

  /**
   * A dApp's card on top, the same element whatever happens under it (no flicker when
   * its queue fills or empties): with its queued requests, a deck.
   */
  const deck = (top: PendingRequest, queue: PendingRequest[]) => {
    // Still spread while its last card leaves.
    const spread = queue.length > 0 || !!leavingQueued[top.origin]?.length
    const open = !!openDecks[top.origin] && spread
    const queueId = `request-queue-${top.interactionId}`
    const toggle = () =>
      setOpenDecks((decksOpen) => ({ ...decksOpen, [top.origin]: !open }))
    return (
      <li
        key={`top:${top.origin}`}
        data-flip={`top:${top.origin}`}
        className={`request-deck${open ? ' request-deck--open' : ''}${
          queue.length ? '' : ' request-deck--single'
        }${leaving[top.origin]?.length ? ' request-deck--advancing' : ''}`}
        data-testid={queue.length ? 'request-queue' : undefined}
      >
        {/* The card in progress, with the queued ones peeking out under it: a click on
            it (not on its buttons) lays them out. The button below does it by keyboard. */}
        <div
          className="request-deck__top"
          onClick={(event) => {
            if (
              queue.length &&
              !(event.target as HTMLElement).closest('button')
            )
              toggle()
          }}
        >
          {topCard(top)}
          {queue.length > 0 && (
            // The click on the card, for the keyboard: seen only when focused.
            <button
              type="button"
              className="request-deck__keyboard-toggle"
              aria-expanded={open}
              aria-controls={queueId}
              onClick={toggle}
            >
              {open
                ? 'Hide the requests waiting for their turn'
                : queue.length === 1
                ? 'Show the request waiting for its turn'
                : `Show the ${queue.length} requests waiting for their turn`}
            </button>
          )}
        </div>
        {spread && (
          <Collapse open={open}>
            <div id={queueId} className="request-deck__spread">
              {withGoneAtPlaces(queue, leavingQueued[top.origin] ?? []).map(
                ({ request, leaving: going }, index) => (
                  <div
                    key={request.interactionId}
                    data-flip={`card:${request.interactionId}`}
                    className={`request-deck__card${
                      going
                        ? going.promoted
                          ? ' request-deck__card--promoted'
                          : ' request-deck__card--removed'
                        : arrivingQueued.has(request.interactionId)
                        ? ' request-deck__card--joining'
                        : ''
                    }`}
                    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- CSS custom property not in CSSProperties
                    style={{ '--deck-index': index } as CSSProperties}
                    aria-hidden={going ? true : undefined}
                  >
                    <div className="request-deck__card-place">
                      {card(request, going ? 'request-card--hidden' : '')}
                    </div>
                  </div>
                ),
              )}
            </div>
          </Collapse>
        )}
      </li>
    )
  }

  const pendingCount = requests.filter(
    (request) => !isFinalStatus(request.status),
  ).length

  return (
    <section
      ref={sectionRef}
      className={`pending-requests${
        settled ? ' pending-requests--settled' : ''
      }${emptying ? ' pending-requests--emptying' : ''}`}
      aria-labelledby="pending-requests-title"
      data-testid="pending-requests"
    >
      <BeforeCommit before={snapshot}>
        <h2 id="pending-requests-title" className="main-view__section-title">
          Pending requests
          {pendingCount > 0 && (
            <CountBadge count={pendingCount} className="main-view__count" />
          )}
        </h2>
        <ul className="request-list">
          {withGoneAtPlaces(shown, leavingItems).map(
            ({ request, leaving: going }) =>
              going ? (
                <li
                  key={`leaving:${going.key}:${request.interactionId}`}
                  className="request-list__leaving"
                  aria-hidden="true"
                >
                  {card(request, leavingClasses(request))}
                </li>
              ) : layout.tops.get(request.origin)?.interactionId ===
                request.interactionId ? (
                deck(request, decks.get(request.interactionId) ?? [])
              ) : (
                <li
                  key={`item:${request.interactionId}`}
                  data-flip={`item:${request.interactionId}`}
                >
                  {card(request)}
                </li>
              ),
          )}
        </ul>
      </BeforeCommit>
    </section>
  )
}

/** `PendingRequestsView` of the offscreen document's requests, kept up to date. */
export const PendingRequests = () => {
  const connections = useConnectionsClient().connections ?? {}
  const walletNames = Object.fromEntries(
    Object.entries(connections).map(([id, connection]) => [
      shortWalletKey(id),
      connection.walletName,
    ]),
  )
  return (
    <PendingRequestsView {...usePendingRequests()} walletNames={walletNames} />
  )
}
