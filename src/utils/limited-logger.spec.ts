import { describe, it, expect, vi } from 'vitest'
import type { AppLogger } from './logger'
import { LimitedLogger, RepeatLimiter } from './limited-logger'

const clock = () => {
  let time = 0
  return {
    now: () => time,
    advance: (ms: number) => {
      time += ms
    },
  }
}

describe('RepeatLimiter', () => {
  it('lets a key through once per interval and counts what it held back', () => {
    const { now, advance } = clock()
    const limiter = RepeatLimiter({ intervalMs: 1000, now })

    expect(limiter.check('a')).toEqual({ heldBack: 0 })
    expect(limiter.check('a')).toBeUndefined()
    advance(999)
    expect(limiter.check('a')).toBeUndefined()
    advance(1)
    expect(limiter.check('a')).toEqual({ heldBack: 2 })
  })

  it('limits each key on its own', () => {
    const limiter = RepeatLimiter({ intervalMs: 1000, now: () => 0 })

    expect(limiter.check('a')).toBeDefined()
    expect(limiter.check('b')).toBeDefined()
    expect(limiter.check('a')).toBeUndefined()
  })

  it('lets a burst through, then holds back until the interval passed', () => {
    const { now, advance } = clock()
    const limiter = RepeatLimiter({ intervalMs: 1000, burst: 3, now })

    expect(limiter.check('a')).toEqual({ heldBack: 0 })
    advance(10)
    expect(limiter.check('a')).toEqual({ heldBack: 0 })
    expect(limiter.check('a')).toEqual({ heldBack: 0 })
    expect(limiter.check('a')).toBeUndefined()
    expect(limiter.check('a')).toBeUndefined()
    advance(990)
    expect(limiter.check('a')).toEqual({ heldBack: 2 })
  })

  it('forgets the oldest keys beyond its capacity', () => {
    const limiter = RepeatLimiter({
      intervalMs: 1000,
      maxKeys: 2,
      now: () => 0,
    })

    limiter.check('a')
    limiter.check('b')
    limiter.check('c')

    // `a` was evicted, so it is new again.
    expect(limiter.check('a')).toEqual({ heldBack: 0 })
    expect(limiter.check('c')).toBeUndefined()
  })
})

describe('LimitedLogger', () => {
  const createLogger = () => {
    const { now, advance } = clock()
    const logger = { warn: vi.fn(), info: vi.fn(), error: vi.fn() }
    const limited = LimitedLogger(logger as unknown as AppLogger, {
      intervalMs: 60_000,
      now,
    })
    return { logger, limited, advance }
  }

  it('logs repeated identical failures once per interval', () => {
    const { logger, limited, advance } = createLogger()

    for (let i = 0; i < 5; i++)
      limited.warn('relay-down', 'relay down', { relay: 'r' })
    advance(60_000)
    limited.warn('relay-down', 'relay down', { relay: 'r' })

    expect(logger.warn).toHaveBeenCalledTimes(2)
    expect(logger.warn).toHaveBeenNthCalledWith(1, 'relay down', { relay: 'r' })
    expect(logger.warn).toHaveBeenNthCalledWith(2, 'relay down', {
      relay: 'r',
      repeatedSinceLastLog: 4,
    })
  })

  it('does not hold back different failures or levels', () => {
    const { logger, limited } = createLogger()

    limited.warn('a', 'first')
    limited.warn('b', 'second')
    limited.info('a', 'same key, other level')

    expect(logger.warn).toHaveBeenCalledTimes(2)
    expect(logger.info).toHaveBeenCalledWith('same key, other level')
  })

  it('does nothing without a logger', () => {
    expect(() =>
      LimitedLogger(undefined, { intervalMs: 1 }).warn('a', 'b'),
    ).not.toThrow()
  })
})
