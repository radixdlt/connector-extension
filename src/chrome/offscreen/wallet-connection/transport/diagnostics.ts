import type { IrohDiagnostics } from '@genkipool/radix-connect-iroh'
import type { RadixConnectTransport } from 'options/radix-connect-transport'
import { maskIpAddresses } from 'utils/log-summary'
import type { TransportEvent } from './transport-events'
import type { IrohLibraryEvent } from './iroh/iroh-library-log'

// Connection diagnostics of the linked wallets, for logs, the options page and bug
// reports. None of these types may hold a secret (connection passwords, keys) or
// message contents.

/**
 * First 8 hex characters of a wallet's public key: tells links apart in logs.
 * Tolerates malformed stored connections.
 */
export const shortWalletKey = (walletPublicKey: string | undefined) =>
  String(walletPublicKey ?? '').slice(0, 8)

export const transportNames = ['iroh', 'webrtc'] as const

export type TransportName = (typeof transportNames)[number]

export type TransportError = {
  message: string
  /** Milliseconds since the epoch. */
  at: number
}

export type WebRtcDiagnostics = {
  connected: boolean
  signalingServer?: string
  signalingConnected: boolean
  peerConnectionState?: RTCPeerConnectionState
  iceConnectionState?: RTCIceConnectionState
  lastError?: TransportError
  /** While connected. */
  connectedForMs?: number
  /** How many times the wallet connected (more than once: reconnections). */
  connects?: number
}

/**
 * The fields of the library's snapshot shown to users. The full endpoint ids are
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

/** Messages of one link since it was opened. */
export type LinkStats = {
  sent: Record<TransportName, number>
  received: Record<TransportName, number>
  /** Sent through the other transport after the first one could not send it. */
  fallbacks: number
  /** Not sent through any transport. */
  failed: number
  /** Messages from the wallet received twice (e.g. over both transports). */
  duplicatesDropped: number
}

export type TransportDiagnostics = {
  /** `undefined` until the options are known. */
  transport?: RadixConnectTransport
  connected: boolean
  webRtc?: WebRtcDiagnostics
  iroh?: IrohTransportDiagnostics
  /**
   * The connected transport the next message goes through: iroh while it is
   * connected (and has not just failed to deliver one), WebRTC otherwise.
   */
  sendingVia?: TransportName
  /** While WebRTC is preferred because iroh just failed to deliver a message. */
  irohHeldBackForMs?: number
  /** How many times each transport connected to the wallet. */
  connects?: Record<TransportName, number>
  stats?: LinkStats
  /** Oldest first. */
  recentEvents?: TransportEvent[]
}

export type WalletConnectionDiagnostics = TransportDiagnostics & {
  walletName: string
  /** See `shortWalletKey`. */
  walletKey: string
  /** Messages waiting to be sent to the wallet (queued or being sent). */
  pending?: { dAppRequests: number; ledgerResponses: number }
  /** The iroh library's warnings that name this link's endpoints. */
  irohLibraryEvents?: IrohLibraryEvent[]
}

export type OffscreenDiagnostics = {
  /** Random id of this offscreen document: a new one means it was restarted. */
  instance: string
  /**
   * The build it runs (`config.buildId`). Pages of an unpacked extension load a new
   * build from disk at once, the offscreen document only once the extension is
   * reloaded. Missing in builds that predate it.
   */
  build?: string
  uptimeMs: number
}

export type ConnectionDiagnosticsResponse = {
  connections: WalletConnectionDiagnostics[]
  offscreen?: OffscreenDiagnostics
  /** All recent warnings and errors of the iroh library in the offscreen document. */
  irohLibraryEvents?: IrohLibraryEvent[]
}

const maskOptional = (text: string | undefined) =>
  text === undefined ? undefined : maskIpAddresses(text)

export const toIrohSessionDiagnostics = (
  snapshot: IrohDiagnostics,
): IrohSessionDiagnostics => ({
  role: snapshot.role,
  relayUrl: snapshot.relayUrl,
  publicRelays: snapshot.publicRelays,
  relayConnected: snapshot.relayConnected,
  // Errors may quote a socket address.
  relayError: maskOptional(snapshot.relayError),
  state: snapshot.state,
  path: snapshot.path,
  rttMs: snapshot.rttMs,
  failedAttempts: snapshot.failedAttempts,
  lastError: maskOptional(snapshot.lastError),
  connectedForMs: snapshot.connectedForMs,
  summary: maskIpAddresses(snapshot.summary),
  keyCollision: snapshot.keyCollision,
})

/**
 * The short endpoint ids in a session summary (`connector <local> → <peer> …`), to
 * tell which iroh library lines are about a link.
 */
export const shortEndpointIdsOf = (summary: string | undefined): string[] => {
  const match = /^\w+ ([0-9a-f]{6,}) → ([0-9a-f]{6,})/.exec(summary ?? '')
  return match ? [match[1], match[2]] : []
}
