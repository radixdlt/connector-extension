import type { IrohLogger } from '@genkipool/radix-connect-iroh'
import { config, isDevMode } from 'config'
import type { AppLogger } from 'utils/logger'
import { LimitedLogger } from 'utils/limited-logger'

/** The log target prefix of the radix-connect-iroh library's own lines. */
const libraryTarget = 'radix_connect_iroh'

/**
 * Routes the iroh library's log lines into the extension's logger, as
 * `<target>: <message>` at their own level:
 * - without `allTargets`, only the radix-connect-iroh library's own lines
 *   (session, relay, peer connected or gone and why) are kept; the lines of iroh's
 *   internals, which may mention socket addresses, are dropped;
 * - the same line is logged at most `burst` times per `intervalMs` (the next one
 *   says how many were held back), except debug and trace lines (dev builds only).
 *
 * Never throws: a failing logger must not break the transport.
 */
export const createIrohLogForwarder = ({
  logger,
  allTargets = isDevMode,
  intervalMs = config.diagnostics.logRepeatInterval,
  burst = 3,
  now,
}: {
  logger: AppLogger
  allTargets?: boolean
  intervalMs?: number
  burst?: number
  now?: () => number
}): IrohLogger => {
  const limited = LimitedLogger(logger, { intervalMs, burst, now })
  return (level, target, message) => {
    try {
      const source = String(target)
      if (!allTargets && !source.startsWith(libraryTarget)) return
      const line = `${source}: ${String(message)}`
      switch (level) {
        case 'error':
        case 'warn':
          return limited[level](line, line)
        case 'info':
          return limited.info(line, line)
        case 'debug':
          return logger.debug(line)
        default:
          return logger.trace(line)
      }
    } catch (error) {
      // Nothing to do: the line is lost, the transport keeps working.
    }
  }
}
