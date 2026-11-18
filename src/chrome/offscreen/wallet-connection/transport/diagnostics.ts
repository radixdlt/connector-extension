import type { IrohDiagnostics } from '@genkipool/radix-connect-iroh'

// The names of a link's transports, and what the iroh transport knows of its
// session (for its logs). None of these types may hold a secret (connection
// passwords, keys) or message contents.

export const transportNames = ['iroh', 'webrtc'] as const

export type TransportName = (typeof transportNames)[number]

export type TransportError = {
  message: string
  /** Milliseconds since the epoch. */
  at: number
}

/**
 * The fields of the library's snapshot kept by the transport. The full endpoint ids are
 * left out (the summary has their short form); an allowlist, so that fields added
 * to the library later are not passed on unreviewed.
 */
export type IrohSessionDiagnostics = Pick<
  IrohDiagnostics,
  | 'role'
  | 'relayUrl'
  | 'publicRelays'
  | 'relayConnected'
  | 'relayError'
  | 'state'
  | 'path'
  | 'rttMs'
  | 'failedAttempts'
  | 'lastError'
  | 'connectedForMs'
  | 'summary'
> & {
  /**
   * Another device or browser profile with this link took this end's place on the
   * relay. Missing from library versions (or offscreen builds) that predate it.
   */
  keyCollision?: boolean
}

export type IrohTransportDiagnostics = {
  connected: boolean
  /** While connected, as measured by the extension. */
  connectedForMs?: number
  /** As configured; `undefined`: n0's public relays. */
  configuredRelayUrl?: string
  relayUrlValid: boolean
  /** The current session, or the last one while the next starts. */
  session?: IrohSessionDiagnostics
  /** Failures of this adapter: starting sessions, configuration, sends. */
  lastError?: TransportError
  startFailures: number
}

export const toIrohSessionDiagnostics = (
  snapshot: IrohDiagnostics,
): IrohSessionDiagnostics => ({
  role: snapshot.role,
  relayUrl: snapshot.relayUrl,
  publicRelays: snapshot.publicRelays,
  relayConnected: snapshot.relayConnected,
  relayError: snapshot.relayError,
  state: snapshot.state,
  path: snapshot.path,
  rttMs: snapshot.rttMs,
  failedAttempts: snapshot.failedAttempts,
  lastError: snapshot.lastError,
  connectedForMs: snapshot.connectedForMs,
  summary: snapshot.summary,
  keyCollision: snapshot.keyCollision,
})
