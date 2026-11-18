import {
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { flushSync } from 'react-dom'

/** Where a press must not start a drag: the card's own controls. */
const controls = 'button, a, input, label, select, textarea, radix-account'
/** How far the pointer moves before a press becomes a drag (pixels). */
const dragThreshold = 5
/** How close to the edge of the scrolling list it scrolls by itself. */
const scrollEdge = 40
const scrollStep = 8
export const settleMs = 180

type Slot = { top: number; height: number }

type Drag = {
  from: number
  to: number
  pointerId: number
  startY: number
  pointerY: number
  startScroll: number
  /** The cards, in the order shown, as measured when the press began. */
  nodes: HTMLElement[]
  slots: Slot[]
  /** How far a card slides to open the place of the dragged one. */
  step: number
  started: boolean
  scroller?: HTMLElement
  scrollerBox?: { top: number; bottom: number }
  frame?: number
}

const scrollerOf = (node: HTMLElement) => {
  for (
    let element = node.parentElement;
    element;
    element = element.parentElement
  )
    if (/(auto|scroll)/.test(getComputedStyle(element).overflowY))
      return element
  return undefined
}

/** The place the dragged card takes: where its centre is among the others. */
const targetOf = ({ slots, from }: Drag, dy: number) => {
  const center = slots[from].top + slots[from].height / 2 + dy
  let to = from
  while (
    to < slots.length - 1 &&
    center > slots[to + 1].top + slots[to + 1].height / 2
  )
    to += 1
  while (to > 0 && center < slots[to - 1].top + slots[to - 1].height / 2)
    to -= 1
  return to
}

/**
 * Drag and drop of the wallet cards, with the mouse: a card lifts and follows the
 * pointer, the others slide to open its new place, and on release it settles
 * there, then `onMove(from, to)`. A press on a card's controls is not a drag.
 *
 * For smoothness, nothing renders while dragging: the places are measured once,
 * when the press begins, and each frame only sets `transform`s (composited by the
 * browser, no layout), at most once per animation frame.
 */
export const useWalletDrag = (
  ids: string[],
  onMove: (from: number, to: number) => void,
) => {
  const nodes = useRef(new Map<string, HTMLElement>())
  const drag = useRef<Drag>()
  const idsRef = useRef(ids)
  idsRef.current = ids
  const onMoveRef = useRef(onMove)
  onMoveRef.current = onMove

  const paint = () => {
    const current = drag.current
    if (!current) return
    current.frame = undefined
    const { scroller, scrollerBox } = current
    if (scroller && scrollerBox) {
      if (current.pointerY < scrollerBox.top + scrollEdge)
        scroller.scrollTop -= scrollStep
      else if (current.pointerY > scrollerBox.bottom - scrollEdge)
        scroller.scrollTop += scrollStep
    }
    const dy =
      current.pointerY -
      current.startY +
      (scroller ? scroller.scrollTop - current.startScroll : 0)
    current.to = targetOf(current, dy)
    const { from, to, step } = current
    current.nodes.forEach((node, index) => {
      if (index === from) {
        node.style.transform = `translateY(${dy}px) scale(1.02)`
        return
      }
      const shift =
        from < to && index > from && index <= to
          ? -step
          : from > to && index >= to && index < from
          ? step
          : 0
      node.style.transform = shift ? `translateY(${shift}px)` : ''
    })
    // Keep scrolling while the pointer rests near an edge.
    if (
      scroller &&
      scrollerBox &&
      (current.pointerY < scrollerBox.top + scrollEdge ||
        current.pointerY > scrollerBox.bottom - scrollEdge)
    )
      current.frame = requestAnimationFrame(paint)
  }

  /** Back to no transforms, without animating there. */
  const reset = (current: Drag) => {
    for (const node of current.nodes) {
      node.style.transition = 'none'
      node.style.transform = ''
      delete node.dataset.dragging
    }
    document.body.classList.remove('rdx-dragging')
  }

  const onPointerMove = (event: PointerEvent) => {
    const current = drag.current
    if (!current || event.pointerId !== current.pointerId) return
    current.pointerY = event.clientY
    if (!current.started) {
      if (Math.abs(event.clientY - current.startY) < dragThreshold) return
      current.started = true
      document.body.classList.add('rdx-dragging')
      current.nodes.forEach((node, index) => {
        node.style.transition =
          index === current.from ? 'none' : `transform ${settleMs}ms ease`
      })
      current.nodes[current.from].dataset.dragging = ''
    }
    current.frame ??= requestAnimationFrame(paint)
  }

  const stopListening = () => {
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    window.removeEventListener('pointercancel', onPointerUp)
  }

  const onPointerUp = (event: PointerEvent) => {
    const current = drag.current
    if (!current || event.pointerId !== current.pointerId) return
    stopListening()
    drag.current = undefined
    if (current.frame !== undefined) cancelAnimationFrame(current.frame)
    if (!current.started) return
    const { from, to, slots, nodes: cards } = current
    // Into its new place: the top of the slot it takes, then the new order.
    const dy =
      to > from
        ? slots[to].top +
          slots[to].height -
          slots[from].height -
          slots[from].top
        : slots[to].top - slots[from].top
    const dragged = cards[from]
    delete dragged.dataset.dragging
    dragged.style.transition = `transform ${settleMs}ms ease`
    dragged.style.transform = `translateY(${dy}px)`
    // The new order is rendered first, synchronously, and the transforms are only
    // then removed, in the same task: the next frame shows every card where it
    // ended, with no frame of the old order in between.
    window.setTimeout(() => {
      if (from !== to) flushSync(() => onMoveRef.current(from, to))
      reset(current)
    }, settleMs)
  }

  useEffect(
    () => () => {
      stopListening()
      if (drag.current) reset(drag.current)
    },
    // The listeners are this hook's own functions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  return (id: string) => ({
    ref: (node: HTMLElement | null) => {
      if (node) nodes.current.set(id, node)
      else nodes.current.delete(id)
    },
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
      if (drag.current || event.button !== 0 || event.pointerType === 'touch')
        return
      if ((event.target as HTMLElement).closest(controls)) return
      const order = idsRef.current
      const cards = order.map((walletId) => nodes.current.get(walletId)!)
      // Measured once: nothing is read from the layout while dragging.
      const slots = cards.map((node) => {
        const box = node.getBoundingClientRect()
        return { top: box.top, height: box.height }
      })
      const from = order.indexOf(id)
      const scroller = scrollerOf(event.currentTarget)
      const scrollerBox = scroller?.getBoundingClientRect()
      drag.current = {
        from,
        to: from,
        pointerId: event.pointerId,
        startY: event.clientY,
        pointerY: event.clientY,
        startScroll: scroller?.scrollTop ?? 0,
        nodes: cards,
        slots,
        step:
          slots[from].height +
          (slots.length > 1
            ? slots[1].top - slots[0].top - slots[0].height
            : 0),
        started: false,
        scroller,
        scrollerBox,
      }
      window.addEventListener('pointermove', onPointerMove)
      window.addEventListener('pointerup', onPointerUp)
      window.addEventListener('pointercancel', onPointerUp)
    },
  })
}
