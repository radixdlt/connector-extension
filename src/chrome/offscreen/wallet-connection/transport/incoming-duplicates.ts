import type { TransportMessage } from './wallet-transport'
import type { TransportName } from './diagnostics'

/** Two 32-bit hashes (FNV-1a and a variant) of `text` and its length, as one key. */
const fingerprint = (text: string) => {
  let a = 0x811c9dc5
  let b = 0x01000193 ^ text.length
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index)
    a = Math.imul(a ^ code, 0x01000193)
    b = Math.imul(b ^ code, 0x5bd1e995)
  }
  return `${text.length}:${(a >>> 0).toString(36)}:${(b >>> 0).toString(36)}`
}

const maxRecentIncoming = 200

/**
 * The messages a wallet sent lately, over any transport, to drop the copies it may send
 * over several: a message identical to one received within `windowMs`. Only their
 * fingerprints are kept, never logged.
 */
export const IncomingDuplicates = ({
  windowMs,
  now,
}: {
  windowMs: number
  now: () => number
}) => {
  // Oldest first.
  const recent = new Map<string, { at: number; via: TransportName }>()

  /**
   * `message`, received now `via` a transport: the first copy, when it is a duplicate
   * of one received lately; otherwise it is noted.
   */
  const check = (message: TransportMessage, via: TransportName) => {
    let key: string | undefined
    try {
      key = fingerprint(JSON.stringify(message))
    } catch (error) {
      key = undefined
    }
    const time = now()
    for (const [entryKey, entry] of recent) {
      if (time - entry.at < windowMs && recent.size < maxRecentIncoming) break
      recent.delete(entryKey)
    }
    const first = key ? recent.get(key) : undefined
    if (!first && key) recent.set(key, { at: time, via })
    return { first, time }
  }

  return { check }
}
