import { describe, it, expect, vi } from 'vitest'
import type { AppLogger } from 'utils/logger'
import { createIrohLogForwarder } from './iroh-library-log'

const createSuite = ({ allTargets = true } = {}) => {
  const clock = { time: 1_000 }
  const logger = {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
  }
  const forward = createIrohLogForwarder({
    logger: logger as unknown as AppLogger,
    allTargets,
    intervalMs: 60_000,
    burst: 2,
    now: () => clock.time,
  })
  return { clock, logger, forward }
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

  it("keep only the library's own lines outside builds with dev tools", () => {
    const { logger, forward } = createSuite({ allTargets: false })

    forward('warn', 'radix_connect_iroh::session', 'relay lost')
    forward('warn', 'iroh::socket', 'could not reach 203.0.113.7:443')
    forward('info', 'iroh_relay::client', 'connected')

    expect(logger.warn).toHaveBeenCalledTimes(1)
    expect(logger.warn).toHaveBeenCalledWith(
      'radix_connect_iroh::session: relay lost',
    )
    expect(logger.info).not.toHaveBeenCalled()
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
