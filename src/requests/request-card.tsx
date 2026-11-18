import type { ReactNode } from 'react'
import {
  isFinalStatus,
  type PendingRequest,
} from 'chrome/offscreen/requests/pending-request'
import { PhoneIcon, ScheduleIcon, WarningIcon } from 'ui/icons'
import {
  CANCELLING,
  SENDING_AGAIN,
  elapsed,
  footerStatuses,
  hasFooter,
  isCancellable,
  recipientOf,
  requestKindLabels,
  statusLabel,
  walletComesBackNotice,
  walletDisconnectedNotice,
  walletNotConnectedBanner,
} from './request-texts'

/**
 * How many, as a badge beside some words. The number just changes: an animation of it
 * (a pop, a fade) showed as a bounce or a blank badge whenever a request was answered.
 */
export const CountBadge = ({
  count,
  className,
}: {
  count: number
  className: string
}) => (
  <span className={className} aria-label={`${count}`}>
    {count}
  </span>
)

/**
 * A card's footer (what to do while it waits), grown into place when it appears: its
 * height opens as it fades in, instead of being there at once, at the card's bottom,
 * where it seemed to lie over the card below.
 */
const FooterReveal = ({
  children,
  leaving,
}: {
  children: ReactNode
  /** The footer of a card that no longer has one: it closes (see `useLayoutMotion`). */
  leaving?: boolean
}) => (
  <div
    className={`request-card__reveal${
      leaving ? ' request-card__reveal--leaving' : ''
    }`}
    aria-hidden={leaving ? true : undefined}
  >
    <div className="request-card__reveal-content">{children}</div>
  </div>
)

/**
 * What to do while a request waits, at its card's bottom: a banner while no wallet is
 * connected, a notice when its wallet disconnected without answering. `leaving`: the
 * footer as it was, drawn while it closes, which no one can use any more.
 */
const footerOf = (
  request: PendingRequest,
  resend: (request: PendingRequest) => void,
  leaving = false,
) => {
  const live = (testId: string) =>
    leaving ? {} : { role: 'status', 'data-testid': testId }
  if (request.status === 'waitingForWallet')
    return (
      <p
        className="request-card__footer"
        {...live('wallet-not-connected-banner')}
      >
        <WarningIcon />
        {walletNotConnectedBanner}
      </p>
    )
  return (
    <div
      className="request-card__footer"
      {...live('wallet-disconnected-notice')}
    >
      <WarningIcon />
      <div className="request-card__footer-body">
        <strong className="request-card__footer-title">
          {request.comesBack
            ? walletComesBackNotice.title
            : walletDisconnectedNotice.title}
        </strong>
        <span>
          {request.comesBack
            ? walletComesBackNotice.text
            : walletDisconnectedNotice.text}
        </span>
        {/* A wallet that reports its requests gets a lost one back by itself;
            sending it again could show it twice in one that kept it. */}
        {!request.comesBack && (
          <button
            type="button"
            className="rdx-text-button request-card__resend"
            disabled={leaving}
            tabIndex={leaving ? -1 : undefined}
            onClick={() => resend(request)}
          >
            Send again
          </button>
        )}
      </div>
    </div>
  )
}

/** What the cards of one render share. */
export type CardContext = {
  /** What each card says while something is under way, or what came of it. */
  notes: Record<string, string>
  /** What each card said at the render before. */
  said: ReadonlyMap<string, string>
  /** What each card in sight says now: filled as the cards are drawn. */
  saying: Map<string, string>
  now: number
  /** The names of the linked wallets, by short wallet key. */
  walletNames: Record<string, string>
  cancel: (request: PendingRequest) => void
  resend: (request: PendingRequest) => void
  /**
   * The cards whose footer just went, by interaction id: the request as it was, for
   * its footer to close (see `useLeavingFooters`).
   */
  footersGoing: ReadonlyMap<string, PendingRequest>
}

/**
 * One request's card; `extra`: classes for how it moves. A function rather than a
 * component: drawn within its list's render, it records what it says (`saying`).
 */
// eslint-disable-next-line complexity -- one card render, many conditional classes and parts
export const requestCard = (
  request: PendingRequest,
  extra: string,
  {
    notes,
    said: saidBefore,
    saying,
    now,
    walletNames,
    cancel,
    resend,
    footersGoing,
  }: CardContext,
) => {
  const footerGoing = footersGoing.get(request.interactionId)
  const kind = requestKindLabels[request.kind]
  const origin = request.origin || 'Unknown dApp'
  const note = notes[request.interactionId]
  // Under way (cancelling, sending again): said in place of its status, so that the
  // card keeps its height. A note on its own line, then gone, made the cards below
  // bounce just before it left.
  const busy = note === CANCELLING || note === SENDING_AGAIN
  const status = busy ? note : statusLabel(request)
  const said = saidBefore.get(request.interactionId)
  const statusChanged = said !== undefined && said !== status
  const footerNow = hasFooter(request)
  const footerNew =
    statusChanged && footerNow && !footerStatuses.has(said ?? '')
  if (!extra.includes('hidden')) saying.set(request.interactionId, status)
  const forWallet = recipientOf(request, walletNames)
  const since = isFinalStatus(request.status)
    ? request.updatedAt
    : request.createdAt
  return (
    <div
      key={request.interactionId}
      data-request-id={request.interactionId}
      className={`request-card${
        isFinalStatus(request.status) ? ' request-card--finished' : ''
      }${busy ? ' request-card--busy' : ''}${
        footerNew ? ' request-card--footer-new' : ''
      }${extra ? ` ${extra}` : ''}`}
      aria-label={`${kind} from ${origin}`}
      data-testid="pending-request"
      data-status={request.status}
    >
      <div className="request-card__body">
        <div className="request-card__header">
          <h3 className="request-card__kind">{kind}</h3>
          <span className="request-card__origin" title={origin}>
            {origin}
          </span>
          {isCancellable(request) && (
            <button
              type="button"
              className="rdx-text-button request-card__cancel"
              aria-label={`Cancel the ${kind.toLowerCase()} from ${origin}`}
              onClick={() => cancel(request)}
            >
              Cancel
            </button>
          )}
        </div>
        <div className="request-card__details">
          <span className="request-card__icon request-card__dot" />
          <span className="request-card__status" title={status}>
            <span
              key={status}
              className={`request-card__status-text${
                statusChanged ? ' request-card__status-text--changed' : ''
              }`}
            >
              {status}
            </span>
          </span>
          <time
            className="request-card__time"
            dateTime={new Date(since).toISOString()}
            title={new Date(since).toLocaleString()}
          >
            <ScheduleIcon />
            {elapsed(request, now)}
          </time>
          {forWallet && (
            <>
              <span className="request-card__icon">
                <PhoneIcon />
              </span>
              <span className="request-card__wallet" title={forWallet}>
                {forWallet}
              </span>
            </>
          )}
        </div>
        {note && !busy && (
          <span className="request-card__note" role="status">
            {note}
          </span>
        )}
      </div>
      {request.status === 'waitingForWallet' && (
        <FooterReveal>{footerOf(request, resend)}</FooterReveal>
      )}
      {request.status === 'walletDisconnected' && (
        <FooterReveal>{footerOf(request, resend)}</FooterReveal>
      )}
      {footerGoing && !hasFooter(request) && (
        <FooterReveal leaving>
          {footerOf(footerGoing, resend, true)}
        </FooterReveal>
      )}
    </div>
  )
}
