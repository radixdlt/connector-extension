import {
  Component,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { PendingRequest } from 'chrome/offscreen/requests/pending-request'
import { hasFooter } from './request-texts'
import {
  itemKeyOf,
  queuesOf,
  type LeavingItem,
  type LeavingQueued,
  type RequestLayout,
} from './request-layout'

/**
 * How long a card leaving keeps its place before it closes: until it has nearly slid
 * away, so that it goes first and its gap closes after.
 */
export const GAP_CLOSE_DELAY_MS = 220

/** How things move in the list: one motion each, on one curve. */
export const MOVE_MS = 380
export const MOVE_EASING = 'cubic-bezier(0.2, 0.8, 0.2, 1)'

/** How long a card coming up from the spread deck waits for the one going. */
export const MOVE_UP_DELAY_MS = 160

/** How long the card on top takes to go, and the next to take its place. */
export const SWAP_MS = 420

/** How long a card's footer takes to close, once it is no longer needed. */
export const FOOTER_CLOSE_MS = MOVE_MS + 40

/** How long a card leaving an open deck takes to go, and its place to close. */
export const SPREAD_LEAVE_MS = 700

/**
 * Runs `run` after `ms`, unless the component is gone first. Unlike a timer cleared by
 * an effect's cleanup, the next render does not cancel it: the list changes often
 * (every status), and a card on its way out must still be taken away.
 */
export const useLaterRunner = () => {
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>())
  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach((timer) => clearTimeout(timer))
  }, [])
  return (run: () => void, ms: number) => {
    const timer = setTimeout(() => {
      timers.current.delete(timer)
      run()
    }, ms)
    timers.current.add(timer)
  }
}

/**
 * What went from `value` between two renders (`goneBetween`), kept `ms` longer.
 *
 * Worked out while rendering, against the value of the render before (React's way to
 * adjust state to a change of props), never in an effect after it: the render where a
 * card goes is the one that draws it on its way out. Found in an effect, it was drawn
 * one render late, and that render in between, laid out without it, had the list
 * shrink at once (scrolled to the end, the whole view jumped).
 */
export const useGoing = <T, Gone>(
  value: T,
  goneBetween: (before: T, now: T) => Gone[],
  ms: number,
) => {
  const [seen, setSeen] = useState(value)
  const [going, setGoing] = useState<Gone[]>([])
  if (seen !== value) {
    setSeen(value)
    const gone = goneBetween(seen, value)
    if (gone.length) setGoing((current) => [...current, ...gone])
  }
  const later = useLaterRunner()
  const timed = useRef(new Set<Gone>())
  useEffect(() => {
    for (const item of going) {
      if (timed.current.has(item)) continue
      timed.current.add(item)
      later(() => {
        timed.current.delete(item)
        setGoing((current) => current.filter((other) => other !== item))
      }, ms)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [going])
  return going
}

/**
 * The list's entries just gone (answered, cancelled) with no card taking their place:
 * drawn a moment longer at their place, on their way out, while it closes.
 */
export const useLeavingItems = (layout: RequestLayout) =>
  useGoing(
    layout,
    (before, now) => {
      const present = new Set(
        now.shown.map((request) => itemKeyOf(request, now)),
      )
      return before.shown.flatMap((request, index): LeavingItem[] => {
        const key = itemKeyOf(request, before)
        return present.has(key) ? [] : [{ key, request, index }]
      })
    },
    SPREAD_LEAVE_MS,
  )

/**
 * The requests that just left each dApp's queue, by origin: drawn a moment longer at
 * their place in the spread deck, on their way out, while the place closes. And those
 * that just joined a queue already there (not the first ones of a new deck): they
 * come in.
 */
export const useLeavingQueued = (layout: RequestLayout) => {
  const gone = useGoing(
    layout,
    (before, now) => {
      const queues = queuesOf(now)
      return [...queuesOf(before)].flatMap(([origin, queue]) => {
        const present = new Set(
          (queues.get(origin) ?? []).map((request) => request.interactionId),
        )
        return queue.flatMap((request, index): LeavingQueued[] =>
          present.has(request.interactionId)
            ? []
            : [
                {
                  origin,
                  request,
                  index,
                  promoted: now.sorted.some(
                    (other) => other.interactionId === request.interactionId,
                  ),
                },
              ],
        )
      })
    },
    SPREAD_LEAVE_MS,
  )
  const joined = useGoing(
    layout,
    (before, now) => {
      const queues = queuesOf(before)
      return [...queuesOf(now)].flatMap(([origin, queue]) => {
        const known = queues.get(origin)
        if (!known) return []
        const ids = new Set(known.map((request) => request.interactionId))
        return queue
          .filter((request) => !ids.has(request.interactionId))
          .map((request) => request.interactionId)
      })
    },
    SPREAD_LEAVE_MS,
  )
  const leaving: Record<string, LeavingQueued[]> = {}
  for (const item of gone) (leaving[item.origin] ??= []).push(item)
  return { leaving, arriving: new Set(joined) }
}

/**
 * The cards that just left the top of their dApp's deck (answered, cancelled) while
 * another took their place, by origin, oldest first: drawn a moment longer, on their
 * way out. All of them: cancelled quickly one after another, a card still sliding off
 * vanished when the next one left, if only the last was kept.
 */
export const useLeavingTops = (layout: RequestLayout) => {
  const gone = useGoing(
    layout,
    (before, now) =>
      [...before.tops].flatMap(([origin, top]) => {
        const next = now.tops.get(origin)
        return next &&
          next.interactionId !== top.interactionId &&
          !now.sorted.some(
            (request) => request.interactionId === top.interactionId,
          )
          ? [{ origin, request: top }]
          : []
      }),
    SWAP_MS,
  )
  const leaving: Record<string, PendingRequest[]> = {}
  for (const { origin, request } of gone) (leaving[origin] ??= []).push(request)
  return leaving
}

/**
 * The section, once its last card is leaving: the card slides away in its place and
 * then the whole section closes, its space below included, as one motion on the curve
 * of every other gap, so that what is below moves up smoothly and stops where it
 * stays once the section is gone. The card's own place does not close too (see
 * `useLayoutMotion`): two closings at once, each from its own height, made the
 * section grow back mid-way and what is below bounce.
 *
 * Its height is held from the start, where it is now, so that nothing closing inside
 * it meanwhile changes it. A request arriving meanwhile opens it again.
 */
export const useClosingSection = (
  section: { current: HTMLElement | null },
  emptying: boolean,
) => {
  useLayoutEffect(() => {
    const root = section.current
    if (!root || !emptying || typeof root.animate !== 'function') return
    const height = `${root.getBoundingClientRect().height}px`
    const margin = `${parseFloat(getComputedStyle(root).marginBottom) || 0}px`
    const holdFor = GAP_CLOSE_DELAY_MS / (GAP_CLOSE_DELAY_MS + MOVE_MS)
    const closing = root.animate(
      [
        { height, marginBottom: margin, opacity: 1 },
        {
          height,
          marginBottom: margin,
          opacity: 1,
          offset: holdFor,
          easing: MOVE_EASING,
        },
        { height: '0px', marginBottom: '0px', opacity: 0 },
      ],
      { duration: GAP_CLOSE_DELAY_MS + MOVE_MS, fill: 'forwards' },
    )
    return () => closing.cancel()
  }, [section, emptying])
}

/** Where `element` is laid out within `ancestor`, transforms aside. */
export const layoutTop = (element: HTMLElement, ancestor: HTMLElement) => {
  let top = 0
  let at: HTMLElement | null = element
  while (at && at !== ancestor) {
    top += at.offsetTop
    at = at.offsetParent as HTMLElement | null
  }
  return top
}

/** The items that move as one (FLIP): the list's entries, the spread decks' cards. */
export const flipItemsOf = (root: HTMLElement) =>
  [...root.querySelectorAll<HTMLElement>('[data-flip]')].filter(
    (item) => !item.dataset.closing,
  )

/** The item around `element`, within which it is measured (or the list's root). */
export const itemAround = (element: HTMLElement, root: HTMLElement) =>
  (element.parentElement?.closest('[data-flip]') as HTMLElement | null) ?? root

/** The cards in sight, that may rise to their deck's top. */
export const risingCardsOf = (root: HTMLElement) =>
  [
    ...root.querySelectorAll<HTMLElement>('.request-card[data-request-id]'),
  ].filter(
    (card) =>
      !card.closest('.request-swap__leaving') &&
      !card.closest('[data-closing]') &&
      !card.closest(
        '.request-deck:not(.request-deck--open) .request-deck__spread',
      ),
  )

/**
 * Calls `before` right before React changes the DOM within it, as motion libraries
 * do (getSnapshotBeforeUpdate): where things are then is where a move starts from.
 */
export class BeforeCommit extends Component<{
  before: () => void
  children: ReactNode
}> {
  public getSnapshotBeforeUpdate() {
    this.props.before()
    return null
  }

  public componentDidUpdate() {}

  public render() {
    return this.props.children
  }
}

/**
 * The vertical move a running motion gives `element` now. The motions move with
 * `translate`, which adds to an element's own `transform` (a folded deck's cards are
 * drawn up, under its top) instead of replacing it: a move that replaced it started
 * from, and ended in, the wrong place, then jumped.
 */
export const translateYOf = (element: HTMLElement) => {
  const translate = getComputedStyle(element).translate
  if (!translate || translate === 'none') return 0
  return parseFloat(translate.split(' ')[1] ?? '0') || 0
}

/**
 * Every change of the list moves things in one motion each, never in two (FLIP):
 * whatever changes size or place (a footer showing, a card leaving the spread deck, a
 * card coming up to the top) changes the layout at once, before paint; each item that
 * moved then starts where it was seen and slides to its new place. So the cards below
 * never go down and back up again, as when heights were animated, each on its own
 * curve.
 *
 * - Items are the list's entries and the spread decks' cards (`data-flip`), each
 *   measured within the item around it, so that a card does not count its deck's move
 *   twice.
 * - A card that came up to its deck's top from the spread deck below rises from there,
 *   once the card it replaces has started off to the side.
 * - A card leaving stays in its place while it goes, then its place closes: the
 *   layout never shrinks at once.
 */
export const useLayoutMotion = (
  section: { current: HTMLElement | null },
  settled: boolean,
  /** What the list shows: things move only when it changes. */
  changeKey: string,
) => {
  const lastKey = useRef(changeKey)
  const lastWidth = useRef(0)
  const items = useRef(new Map<string, number>())
  const cards = useRef(new Map<string, number>())
  /** Where each card is seen (moving or not), within the section. */
  const seenCards = useRef(new Map<string, number>())
  const isSettled = useRef(settled)
  isSettled.current = settled

  /**
   * Where the items and cards are, right before a change: a move starts from there.
   * Remembered from the render before instead, it was out of date whenever things
   * had moved since without a render (a card's place closing): they then jumped
   * back to where they had been, and moved again.
   */
  const snapshot = () => {
    const root = section.current
    if (!root) return
    items.current = new Map(
      flipItemsOf(root).map((item) => [
        item.dataset.flip ?? '',
        layoutTop(item, itemAround(item, root)),
      ]),
    )
    cards.current = new Map(
      risingCardsOf(root).map((card) => [
        card.dataset.requestId ?? '',
        layoutTop(card, root),
      ]),
    )
    const rootTop = root.getBoundingClientRect().top
    seenCards.current = new Map(
      risingCardsOf(root).map((card) => [
        card.dataset.requestId ?? '',
        card.getBoundingClientRect().top - rootTop,
      ]),
    )
  }

  /** Where the items and cards are now; with `animate`, moves those that moved. */
  // eslint-disable-next-line complexity -- one measuring pass; splitting it risks the animation
  const measure = (animate: boolean) => {
    const root = section.current
    if (!root) return
    const canAnimate = animate && typeof root.animate === 'function'
    const within = (element: HTMLElement) => itemAround(element, root)

    // A footer no longer needed closes, and what is below it moves up with it, in the
    // layout, in one motion: nothing jumps, nothing rises into a gap.
    for (const footer of root.querySelectorAll<HTMLElement>(
      '.request-card__reveal--leaving:not([data-closing])',
    )) {
      footer.dataset.closing = 'true'
      if (typeof footer.animate !== 'function') continue
      footer.animate(
        [
          { height: `${footer.offsetHeight}px`, opacity: 1 },
          { height: '0px', opacity: 0 },
        ],
        { duration: MOVE_MS, easing: MOVE_EASING, fill: 'forwards' },
      )
    }

    // A card leaving stays in its place, in the layout, so that nothing around it
    // changes at once (scrolled to the end, the view jumped as the list shrank). It
    // slides away, or is shown rising to its deck's top, and then its place closes,
    // smoothly: the cards below move up with it, in the layout, in one motion.
    // The last one closes with the whole section instead (`useClosingSection`).
    const emptying = root.classList.contains('pending-requests--emptying')
    for (const leaving of root.querySelectorAll<HTMLElement>(
      '.request-deck__card--removed:not([data-closing]), .request-deck__card--promoted:not([data-closing]), .request-list__leaving:not([data-closing])',
    )) {
      leaving.dataset.closing = 'true'
      if (emptying && leaving.classList.contains('request-list__leaving'))
        continue
      if (typeof leaving.animate !== 'function') continue
      leaving.animate(
        [{ height: `${leaving.offsetHeight}px` }, { height: '0px' }],
        {
          duration: MOVE_MS,
          delay: leaving.classList.contains('request-deck__card--promoted')
            ? MOVE_UP_DELAY_MS
            : GAP_CLOSE_DELAY_MS,
          easing: MOVE_EASING,
          fill: 'forwards',
        },
      )
    }

    const nowItems = new Map<string, number>()
    const moved: { item: HTMLElement; from: number }[] = []
    for (const item of flipItemsOf(root)) {
      const key = item.dataset.flip ?? ''
      const now = layoutTop(item, within(item))
      nowItems.set(key, now)
      const was = items.current.get(key)
      if (canAnimate && was !== undefined && was !== now)
        moved.push({ item, from: was - now + translateYOf(item) })
    }

    // A card on top that was in sight in the spread deck below: it rises from there,
    // once the card it replaces has started off to the side.
    const nowCards = new Map<string, number>()
    const risingDecks = new Set<Element>()
    for (const card of risingCardsOf(root)) {
      const id = card.dataset.requestId ?? ''
      const now = layoutTop(card, root)
      nowCards.set(id, now)
      const was = cards.current.get(id)
      if (
        !canAnimate ||
        was === undefined ||
        card.dataset.movedUp ||
        !card.parentElement?.classList.contains('request-deck__top')
      )
        continue
      const deck = card.closest<HTMLElement>('[data-flip]')
      const key = deck?.dataset.flip ?? ''
      const deckMoved =
        (items.current.get(key) ?? nowItems.get(key) ?? 0) -
        (nowItems.get(key) ?? 0)
      const dy = was - now - deckMoved
      if (dy < 8) continue
      card.dataset.movedUp = 'true'
      if (deck) risingDecks.add(deck)
      card.animate([{ translate: `0 ${dy}px` }, { translate: '0 0' }], {
        duration: MOVE_MS,
        delay: MOVE_UP_DELAY_MS,
        easing: MOVE_EASING,
        fill: 'backwards',
      })
    }

    // A card leaving the top while it was still rising to it (cancelled at once): it
    // slides off from where it was seen, still rising, instead of from the top, where
    // a copy of it appeared at once while the card itself was still on its way.
    const rootTop = root.getBoundingClientRect().top
    for (const leaving of root.querySelectorAll<HTMLElement>(
      '.request-swap__leaving:not([data-placed])',
    )) {
      leaving.dataset.placed = 'true'
      const card = leaving.querySelector<HTMLElement>('[data-request-id]')
      const seen = seenCards.current.get(card?.dataset.requestId ?? '')
      if (!canAnimate || !card || seen === undefined) continue
      const dy = seen - (card.getBoundingClientRect().top - rootTop)
      if (Math.abs(dy) < 1) continue
      leaving.animate([{ translate: `0 ${dy}px` }, { translate: '0 0' }], {
        duration: MOVE_MS,
        easing: MOVE_EASING,
      })
    }

    for (const { item, from } of moved) {
      item.getAnimations().forEach((animation) => {
        if (animation.id === 'flip') animation.cancel()
      })
      if (Math.abs(from) < 1) continue
      // The cards of a deck whose next card rises go with it, not before it: moving up
      // first, they slid over it.
      const withRise = [...risingDecks].some(
        (deck) => deck !== item && deck.contains(item),
      )
      item.animate([{ translate: `0 ${from}px` }, { translate: '0 0' }], {
        duration: MOVE_MS,
        delay: withRise ? MOVE_UP_DELAY_MS : 0,
        easing: MOVE_EASING,
        fill: 'backwards',
        id: 'flip',
      })
    }

    items.current = nowItems
    cards.current = nowCards
  }

  // After every render: what a change of the list moved, moves (once settled). A
  // render that changes nothing (the clock, the same list again) or a section whose
  // width changes (the side panel sliding in, its text rewrapping) only measures:
  // moving cards then was a bounce on opening.
  useLayoutEffect(() => {
    const width = section.current?.getBoundingClientRect().width ?? 0
    const listChanged = changeKey !== lastKey.current
    const sameWidth = width === lastWidth.current
    lastKey.current = changeKey
    lastWidth.current = width
    measure(isSettled.current && listChanged && sameWidth)
  })

  // The panel opening or resizing, fonts arriving: places change with nothing to
  // show for it; they are measured again, with no motion (it was a jolt on opening).
  useEffect(() => {
    const root = section.current
    if (!root) return
    const again = () => {
      lastWidth.current = root.getBoundingClientRect().width
      measure(false)
    }
    const observer =
      typeof ResizeObserver === 'function'
        ? new ResizeObserver(again)
        : undefined
    observer?.observe(root)
    // eslint-disable-next-line no-void -- fire-and-forget
    void document.fonts?.ready.then(again)
    return () => observer?.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return snapshot
}

/**
 * The cards whose footer just went (their wallet connected, or got its lost request
 * back), by interaction id: the request as it was, its footer drawn a moment longer
 * while it closes. Gone at once, the card shrank in one frame, and what was below it
 * rose into a gap.
 */
export const useLeavingFooters = (requests: PendingRequest[]) => {
  const gone = useGoing(
    requests,
    (before, now) => {
      const nowById = new Map(
        now.map((request) => [request.interactionId, request]),
      )
      return before.filter((request) => {
        const next = nowById.get(request.interactionId)
        return hasFooter(request) && !!next && !hasFooter(next)
      })
    },
    FOOTER_CLOSE_MS,
  )
  return new Map(gone.map((request) => [request.interactionId, request]))
}

/** The current time, every second while `ticking`, for elapsed times. */
export const useNow = (ticking: boolean) => {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (!ticking) return
    const timer = setInterval(() => setNow(Date.now()), 1_000)
    return () => clearInterval(timer)
  }, [ticking])
  return now
}
