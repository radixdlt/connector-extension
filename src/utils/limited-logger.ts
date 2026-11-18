import type { AppLogger } from './logger'

/**
 * Lets the first `burst` occurrences of a key through, then holds it back until
 * `intervalMs` passed since the first of them, and tells how many were held back in
 * between. With the default `burst` of 1: at most one per `intervalMs`.
 */
export const RepeatLimiter = ({
  intervalMs,
  burst = 1,
  maxKeys = 200,
  now = Date.now,
}: {
  intervalMs: number
  burst?: number
  maxKeys?: number
  now?: () => number
}) => {
  const entries = new Map<
    string,
    { windowStart: number; count: number; heldBack: number }
  >()

  /** `undefined` when this occurrence should be dropped. */
  const check = (key: string): { heldBack: number } | undefined => {
    const time = now()
    const entry = entries.get(key)
    if (entry && time - entry.windowStart < intervalMs) {
      if (entry.count < burst) {
        entry.count += 1
        return { heldBack: 0 }
      }
      entry.heldBack += 1
      return undefined
    }
    // Re-inserted last, so that the oldest keys are evicted first.
    entries.delete(key)
    entries.set(key, { windowStart: time, count: 1, heldBack: 0 })
    if (entries.size > maxKeys) {
      const oldest = entries.keys().next().value
      if (oldest !== undefined) entries.delete(oldest)
    }
    return { heldBack: entry?.heldBack ?? 0 }
  }

  return { check }
}

export type LimitedLogger = ReturnType<typeof LimitedLogger>

/**
 * Logs failures that may repeat (a relay that stays down, a wallet that keeps
 * failing to connect...) once per `intervalMs` for the same `key`, so that they do
 * not flood the exported logs. The next log of a key says how many were skipped.
 */
export const LimitedLogger = (
  logger: AppLogger | undefined,
  options: { intervalMs: number; burst?: number; now?: () => number },
) => {
  const limiter = RepeatLimiter(options)

  const log =
    (level: 'error' | 'warn' | 'info') =>
    (key: string, message: string, details?: Record<string, unknown>) => {
      if (!logger) return
      const allowed = limiter.check(`${level}:${key}`)
      if (!allowed) return
      const extra = allowed.heldBack
        ? { ...details, repeatedSinceLastLog: allowed.heldBack }
        : details
      if (extra) logger[level](message, extra)
      else logger[level](message)
    }

  return { error: log('error'), warn: log('warn'), info: log('info') }
}
