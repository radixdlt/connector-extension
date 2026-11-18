import type { AppLogger } from 'utils/logger'
import { globalTimers, type Timers } from 'utils/timers'

/**
 * Tells when the computer woke from sleep, without any permission: a timer ticks
 * every `intervalMs`, and a tick that comes much later in real (wall clock) time than
 * expected means the computer was suspended meanwhile.
 *
 * A gap counts when it exceeds `gapThresholdMs` and is more than twice the previous
 * one: a page whose timers Chrome throttles (e.g. to one per minute) has steady
 * large gaps, which are not reported again and again.
 *
 * `onWake` gets how long the computer slept (the gap minus one interval).
 */
export const WakeDetector = ({
  intervalMs,
  gapThresholdMs,
  onWake,
  now = Date.now,
  timers = globalTimers,
}: {
  intervalMs: number
  gapThresholdMs: number
  onWake: (sleptMs: number) => void
  now?: () => number
  timers?: Timers
}) => {
  let handle: unknown
  let last = 0
  let previousGap = intervalMs

  const tick = () => {
    const time = now()
    const gap = time - last
    last = time
    if (gap > gapThresholdMs && gap > 2 * previousGap)
      onWake(Math.max(gap - intervalMs, 0))
    previousGap = Math.max(gap, intervalMs)
  }

  return {
    start: () => {
      if (handle !== undefined) return
      last = now()
      previousGap = intervalMs
      handle = timers.setInterval(tick, intervalMs)
    },
    stop: () => {
      if (handle === undefined) return
      timers.clearInterval(handle)
      handle = undefined
    },
  }
}

/**
 * Runs `run` at most once per `windowMs`: the first trigger at once, the ones that
 * follow within the window together once it ends (with all their reasons), so that
 * the last change (e.g. the network coming back right after a wake-up) is always
 * acted upon.
 */
export const Debouncer = ({
  windowMs,
  run,
  now = Date.now,
  timers = globalTimers,
}: {
  windowMs: number
  run: (reason: string) => void
  now?: () => number
  timers?: Timers
}) => {
  let lastRunAt: number | undefined
  let handle: unknown
  const pendingReasons: string[] = []

  const flush = () => {
    handle = undefined
    lastRunAt = now()
    const reason = pendingReasons.join(', ')
    pendingReasons.length = 0
    run(reason)
  }

  return {
    trigger: (reason: string) => {
      const time = now()
      if (
        handle === undefined &&
        (lastRunAt === undefined || time - lastRunAt >= windowMs)
      ) {
        lastRunAt = time
        run(reason)
        return
      }
      if (!pendingReasons.includes(reason)) pendingReasons.push(reason)
      if (handle === undefined)
        handle = timers.setTimeout(
          flush,
          Math.max(windowMs - (time - (lastRunAt ?? time)), 0),
        )
    },
    stop: () => {
      if (handle !== undefined) timers.clearTimeout(handle)
      handle = undefined
      pendingReasons.length = 0
    },
  }
}

const formatSeconds = (ms: number) => `${Math.round(ms / 1000)}s`

/**
 * Calls `onNetworkChange(reason)` when the network may have changed under the
 * wallet links: when the browser goes back `online`, and when the computer wakes
 * from sleep (`wake after <N>s`). At most once per `debounceMs`.
 */
export const NetworkChangeWatcher = ({
  onNetworkChange,
  target,
  logger,
  wakeCheckIntervalMs,
  wakeGapThresholdMs,
  debounceMs,
  now = Date.now,
  timers = globalTimers,
}: {
  onNetworkChange: (reason: string) => void
  /** Fires `online` (the offscreen document's `window`). */
  target: Pick<Window, 'addEventListener' | 'removeEventListener'>
  logger?: AppLogger
  wakeCheckIntervalMs: number
  wakeGapThresholdMs: number
  debounceMs: number
  now?: () => number
  timers?: Timers
}) => {
  const debouncer = Debouncer({
    windowMs: debounceMs,
    run: onNetworkChange,
    now,
    timers,
  })
  const report = (reason: string) => {
    logger?.info('network change detected', { reason })
    debouncer.trigger(reason)
  }
  const wakeDetector = WakeDetector({
    intervalMs: wakeCheckIntervalMs,
    gapThresholdMs: wakeGapThresholdMs,
    onWake: (sleptMs) => report(`wake after ${formatSeconds(sleptMs)}`),
    now,
    timers,
  })
  const onOnline = () => report('online')

  return {
    start: () => {
      target.addEventListener('online', onOnline)
      wakeDetector.start()
    },
    stop: () => {
      target.removeEventListener('online', onOnline)
      wakeDetector.stop()
      debouncer.stop()
    },
  }
}
