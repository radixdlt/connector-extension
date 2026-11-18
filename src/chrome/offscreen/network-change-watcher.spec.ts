import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  Debouncer,
  NetworkChangeWatcher,
  WakeDetector,
} from './network-change-watcher'

/** The computer sleeps: real time jumps, no timer runs meanwhile. */
const sleepFor = (ms: number) => vi.setSystemTime(Date.now() + ms)

describe('WakeDetector', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  const createDetector = () => {
    const onWake = vi.fn()
    const detector = WakeDetector({
      intervalMs: 5_000,
      gapThresholdMs: 15_000,
      onWake,
    })
    detector.start()
    return { detector, onWake }
  }

  it('stays quiet while the timer ticks on time', () => {
    const { onWake } = createDetector()

    vi.advanceTimersByTime(60_000)

    expect(onWake).not.toHaveBeenCalled()
  })

  it('reports a wake-up, with how long the computer slept', () => {
    const { onWake } = createDetector()
    vi.advanceTimersByTime(10_000)

    sleepFor(60_000)
    vi.advanceTimersByTime(5_000)

    expect(onWake).toHaveBeenCalledTimes(1)
    expect(onWake).toHaveBeenCalledWith(60_000)

    vi.advanceTimersByTime(30_000)
    expect(onWake).toHaveBeenCalledTimes(1)
  })

  it('ignores gaps up to the threshold', () => {
    const { onWake } = createDetector()

    sleepFor(10_000)
    vi.advanceTimersByTime(5_000)

    expect(onWake).not.toHaveBeenCalled()
  })

  it('reports nothing once stopped', () => {
    const { detector, onWake } = createDetector()

    detector.stop()
    sleepFor(60_000)
    vi.advanceTimersByTime(10_000)

    expect(onWake).not.toHaveBeenCalled()
  })

  it('does not take steadily throttled timers for wake-ups, but still sees a sleep', () => {
    // Chrome may run the timers of a hidden page once a minute only.
    let time = 0
    let tick = () => {}
    const onWake = vi.fn()
    WakeDetector({
      intervalMs: 5_000,
      gapThresholdMs: 15_000,
      onWake,
      now: () => time,
      timers: {
        setInterval: (callback) => {
          tick = callback
        },
        clearInterval: () => {},
        setTimeout: () => {},
        clearTimeout: () => {},
      },
    }).start()
    const tickAfter = (ms: number) => {
      time += ms
      tick()
    }

    tickAfter(5_000)
    tickAfter(60_000) // throttling starts: indistinguishable from a short sleep
    tickAfter(60_000)
    tickAfter(60_000)
    expect(onWake).toHaveBeenCalledTimes(1)

    tickAfter(3_600_000)
    expect(onWake).toHaveBeenCalledTimes(2)
    expect(onWake).toHaveBeenLastCalledWith(3_595_000)
  })
})

describe('Debouncer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('runs at once, then once more at the end of the window with the reasons it held back', () => {
    const run = vi.fn()
    const debouncer = Debouncer({ windowMs: 3_000, run })

    debouncer.trigger('wake after 60s')
    vi.advanceTimersByTime(1_000)
    debouncer.trigger('online')
    debouncer.trigger('online')
    expect(run.mock.calls).toEqual([['wake after 60s']])

    vi.advanceTimersByTime(2_000)
    expect(run.mock.calls).toEqual([['wake after 60s'], ['online']])

    vi.advanceTimersByTime(3_000)
    debouncer.trigger('online')
    expect(run).toHaveBeenCalledTimes(3)
  })
})

describe('NetworkChangeWatcher', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  const createWatcher = () => {
    const target = new EventTarget()
    const onNetworkChange = vi.fn()
    const logger = { info: vi.fn() }
    const watcher = NetworkChangeWatcher({
      target: target as unknown as Window,
      onNetworkChange,
      logger: logger as any,
      wakeCheckIntervalMs: 5_000,
      wakeGapThresholdMs: 15_000,
      debounceMs: 3_000,
    })
    watcher.start()
    return { target, onNetworkChange, logger, watcher }
  }

  it('reports the browser going back online', () => {
    const { target, onNetworkChange, logger } = createWatcher()

    target.dispatchEvent(new Event('online'))

    expect(onNetworkChange).toHaveBeenCalledWith('online')
    expect(logger.info).toHaveBeenCalledWith('network change detected', {
      reason: 'online',
    })
  })

  it('reports a wake-up from sleep with its duration', () => {
    const { onNetworkChange } = createWatcher()
    vi.advanceTimersByTime(5_000)

    sleepFor(42_000)
    vi.advanceTimersByTime(5_000)

    expect(onNetworkChange).toHaveBeenCalledWith('wake after 42s')
  })

  it('debounces a wake-up followed by the network coming back', () => {
    const { target, onNetworkChange } = createWatcher()
    vi.advanceTimersByTime(5_000)
    sleepFor(120_000)
    vi.advanceTimersByTime(5_000)

    vi.advanceTimersByTime(500)
    target.dispatchEvent(new Event('online'))
    expect(onNetworkChange.mock.calls).toEqual([['wake after 120s']])

    vi.advanceTimersByTime(3_000)
    expect(onNetworkChange.mock.calls).toEqual([
      ['wake after 120s'],
      ['online'],
    ])
  })

  it('stops listening once stopped', () => {
    const { target, onNetworkChange, watcher } = createWatcher()

    watcher.stop()
    target.dispatchEvent(new Event('online'))
    sleepFor(60_000)
    vi.advanceTimersByTime(10_000)

    expect(onNetworkChange).not.toHaveBeenCalled()
  })
})
