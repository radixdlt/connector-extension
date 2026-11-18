import type { TransportName } from './diagnostics'

/** What an event is about: the link as a whole, or one of its transports. */
export type TransportEventSource = 'link' | TransportName

/**
 * One line of a link's recent history, for the diagnostics panel and bug reports.
 * `event` is built from codes, ids and durations only: never a secret, an address
 * or a message's contents.
 */
export type TransportEvent = {
  /** Milliseconds since the epoch (of the last occurrence when repeated). */
  at: number
  source: TransportEventSource
  event: string
  /** How many times in a row it happened, when more than once. */
  count?: number
}

/**
 * The last `max` events, oldest first. The same event repeated in a row is kept once
 * with a count, so that a flapping connection does not push everything else out.
 */
export const RecentEvents = ({
  max,
  now = Date.now,
}: {
  max: number
  now?: () => number
}) => {
  const events: TransportEvent[] = []

  const add = (source: TransportEventSource, event: string) => {
    const last = events[events.length - 1]
    if (last && last.source === source && last.event === event) {
      last.count = (last.count ?? 1) + 1
      last.at = now()
      return
    }
    events.push({ at: now(), source, event })
    if (events.length > max) events.shift()
  }

  return {
    add,
    list: (): TransportEvent[] => events.map((event) => ({ ...event })),
  }
}

export type RecentEvents = ReturnType<typeof RecentEvents>
