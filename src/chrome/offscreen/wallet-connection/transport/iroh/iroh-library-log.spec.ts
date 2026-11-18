import { describe, it, expect, vi } from 'vitest'
import type { AppLogger } from 'utils/logger'
import { createIrohLogForwarder, IrohLibraryEvents } from './iroh-library-log'

const createSuite = () => {
  const clock = { time: 1_000 }
  const logger = {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
  }
  const events = IrohLibraryEvents({ max: 3, now: () => clock.time })
  const forward = createIrohLogForwarder({
    logger: logger as unknown as AppLogger,
    events,
    intervalMs: 60_000,
    burst: 2,
    now: () => clock.time,
  })
  return { clock, logger, events, forward }
}

describe('iroh library logs', () => {
  it('reach the extension logger at their level, with their target', () => {
    const { logger, forward } = createSuite()

    forward('error', 'radix_connect_iroh::session', 'e')
    forward('warn', 'radix_connect_iroh::session', 'w')
    forward('info', 'radix_connect_iroh::session', 'i')
    forward('debug', 'iroh::socket', 'd')
    forward('trace', 'iroh::socket', 't')

    expect(logger.error).toHaveBeenCalledWith('radix_connect_iroh::session: e')
    expect(logger.warn).toHaveBeenCalledWith('radix_connect_iroh::session: w')
    expect(logger.info).toHaveBeenCalledWith('radix_connect_iroh::session: i')
    expect(logger.debug).toHaveBeenCalledWith('iroh::socket: d')
    expect(logger.trace).toHaveBeenCalledWith('iroh::socket: t')
  })

  it('mask IP addresses', () => {
    const { logger, events, forward } = createSuite()

    forward(
      'warn',
      'iroh::socket',
      'could not reach 203.0.113.7:443 or [2001:db8::7]:3478',
    )

    expect(logger.warn).toHaveBeenCalledWith(
      'iroh::socket: could not reach <ip>:443 or [<ip>]:3478',
    )
    expect(JSON.stringify(events.list())).not.toContain('203.0.113.7')
  })

  it('keep warnings visible: the last ones, with how often they happened', () => {
    const { clock, events, forward } = createSuite()
    const displaced =
      'another holder of this link key displaced this endpoint local=c0ffeec0ff'

    forward('warn', 'radix_connect_iroh::session', displaced)
    clock.time = 2_000
    forward('info', 'radix_connect_iroh::session', 'connected to the relay')
    forward('warn', 'radix_connect_iroh::session', displaced)

    expect(events.list()).toEqual([
      {
        at: 2_000,
        level: 'warn',
        target: 'radix_connect_iroh::session',
        message: displaced,
        count: 2,
      },
    ])

    forward('error', 'a', '1')
    forward('error', 'b', '2')
    forward('error', 'c', '3')
    expect(events.list().map((event) => event.target)).toEqual(['a', 'b', 'c'])
  })

  it('rate-limit a line that keeps repeating, and say how often it did', () => {
    const { clock, logger, forward } = createSuite()

    for (let index = 0; index < 5; index += 1)
      forward('warn', 'iroh', 'relay unreachable')
    clock.time += 60_000
    forward('warn', 'iroh', 'relay unreachable')

    expect(logger.warn).toHaveBeenCalledTimes(3)
    expect(logger.warn).toHaveBeenLastCalledWith('iroh: relay unreachable', {
      repeatedSinceLastLog: 3,
    })
  })

  it('never throw, even when the logger does', () => {
    const { logger, forward } = createSuite()
    logger.warn.mockImplementation(() => {
      throw new Error('broken logger')
    })

    expect(() => forward('warn', 'iroh', 'line')).not.toThrow()
  })
})
