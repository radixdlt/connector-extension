import type { IrohLogger } from '@genkipool/radix-connect-iroh'
import { config } from 'config'
import type { AppLogger } from 'utils/logger'
import { LimitedLogger } from 'utils/limited-logger'
import { maskIpAddresses } from 'utils/log-summary'

/**
 * A warning or error of the iroh library (wasm), e.g. that another holder of a
 * link's key took the link over. The library's log callback is not tied to a
 * session: its lines name endpoints by their short ids only.
 */
export type IrohLibraryEvent = {
  /** Milliseconds since the epoch, of the last occurrence. */
  at: number
  level: 'warn' | 'error'
  target: string
  /** IP addresses masked. */
  message: string
  count: number
}

/** The last `max` distinct warnings and errors, most recent last. */
export const IrohLibraryEvents = ({
  max,
  now = Date.now,
}: {
  max: number
  now?: () => number
}) => {
  const events: IrohLibraryEvent[] = []

  const add = (
    level: IrohLibraryEvent['level'],
    target: string,
    message: string,
  ) => {
    const index = events.findIndex(
      (event) =>
        event.level === level &&
        event.target === target &&
        event.message === message,
    )
    const event =
      index >= 0
        ? events.splice(index, 1)[0]
        : { at: 0, level, target, message, count: 0 }
    event.count += 1
    event.at = now()
    events.push(event)
    if (events.length > max) events.shift()
  }

  return {
    add,
    list: (): IrohLibraryEvent[] => events.map((event) => ({ ...event })),
    clear: () => {
      events.length = 0
    },
  }
}

export type IrohLibraryEvents = ReturnType<typeof IrohLibraryEvents>

/** Of this page (the offscreen document, or the pairing popup). */
export const irohLibraryEvents = IrohLibraryEvents({
  max: config.diagnostics.irohLibraryEvents,
})

/**
 * Routes the iroh library's log lines into the extension's logger, as
 * `<target>: <message>` at their own level:
 * - IP addresses are masked (iroh's internals may mention socket addresses),
 * - the same line is logged at most `burst` times per `intervalMs` (the next one
 *   says how many were held back), except debug and trace lines (dev builds only),
 * - warnings and errors are also kept in `events` for the diagnostics panel, so
 *   that they stay visible after the logs rotated.
 *
 * Never throws: a failing logger must not break the transport.
 */
export const createIrohLogForwarder = ({
  logger,
  events = irohLibraryEvents,
  intervalMs = config.diagnostics.logRepeatInterval,
  burst = 3,
  now,
}: {
  logger: AppLogger
  events?: IrohLibraryEvents
  intervalMs?: number
  burst?: number
  now?: () => number
}): IrohLogger => {
  const limited = LimitedLogger(logger, { intervalMs, burst, now })
  return (level, target, message) => {
    try {
      const source = String(target)
      const text = maskIpAddresses(String(message))
      const line = `${source}: ${text}`
      switch (level) {
        case 'error':
        case 'warn':
          events.add(level, source, text)
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
