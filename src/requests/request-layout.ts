import {
  isFinalStatus,
  type PendingRequest,
} from 'chrome/offscreen/requests/pending-request'
import { byAttention } from './request-texts'

/**
 * How the requests are laid out: by attention, each dApp's requests waiting for their
 * turn (the next to go first) under the card of its request in progress, or else of the
 * first of them; `shown` are the cards of the list.
 */
export const layoutOf = (requests: PendingRequest[]) => {
  const sorted = [...requests].sort(byAttention)
  const queues = new Map<string, PendingRequest[]>()
  for (const request of [...requests].sort((a, b) => a.createdAt - b.createdAt))
    if (request.status === 'waitingForTurn')
      queues.set(request.origin, [
        ...(queues.get(request.origin) ?? []),
        request,
      ])
  const decks = new Map<string, PendingRequest[]>()
  for (const [origin, queue] of queues) {
    const top = sorted.find(
      (request) =>
        request.origin === origin &&
        request.status !== 'waitingForTurn' &&
        !isFinalStatus(request.status),
    )
    if (top) decks.set(top.interactionId, queue)
    else decks.set(queue[0].interactionId, queue.slice(1))
  }
  const shown = sorted.filter(
    (request) =>
      request.status !== 'waitingForTurn' || decks.has(request.interactionId),
  )
  // Each dApp's card on top: the first of its cards shown.
  const tops = new Map<string, PendingRequest>()
  for (const request of shown)
    if (!tops.has(request.origin) && !isFinalStatus(request.status))
      tops.set(request.origin, request)
  return { sorted, decks, shown, tops }
}

export type RequestLayout = ReturnType<typeof layoutOf>

/** An entry gone from the list, with nothing in its place: where it was. */
export type LeavingItem = {
  key: string
  request: PendingRequest
  index: number
}

/** A queued request that just left its dApp's open deck, where it was. */
export type LeavingQueued = {
  origin: string
  request: PendingRequest
  index: number
  /** It went up to the top (its turn came), rather than away (cancelled). */
  promoted: boolean
}

/** Each dApp's queue, by origin. */
export const queuesOf = (layout: RequestLayout) => {
  const queues = new Map<string, PendingRequest[]>()
  for (const queue of layout.decks.values())
    if (queue.length) queues.set(queue[0].origin, queue)
  return queues
}

/** An entry's key: a dApp's card on top keeps one whatever card it shows. */
export const itemKeyOf = (request: PendingRequest, layout: RequestLayout) =>
  layout.tops.get(request.origin)?.interactionId === request.interactionId
    ? `top:${request.origin}`
    : `item:${request.interactionId}`

/**
 * Entries shown, with those just gone back at their places: the list's entries, or a
 * spread deck's queue.
 */
export const withGoneAtPlaces = <
  Gone extends { request: PendingRequest; index: number },
>(
  shown: PendingRequest[],
  gone: Gone[],
) => {
  const items: { request: PendingRequest; leaving?: Gone }[] = shown.map(
    (request) => ({ request }),
  )
  for (const item of [...gone].sort((a, b) => a.index - b.index))
    items.splice(Math.min(item.index, items.length), 0, {
      request: item.request,
      leaving: item,
    })
  return items
}
