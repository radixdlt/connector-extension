import type {
  IrohErrorCode,
  IrohRole,
  IrohSession as WasmIrohSession,
} from '@genkipool/radix-connect-iroh'

export type {
  IrohConnectionState,
  IrohErrorCode,
  IrohLogLevel,
  IrohRole,
  IrohSessionEvent,
} from '@genkipool/radix-connect-iroh'

/**
 * The part of the `@genkipool/radix-connect-iroh` (wasm) API the extension uses, as
 * returned by `loadIroh`. Everything but the loader depends only on these types, so
 * it runs in unit tests, where the wasm module cannot be loaded.
 */
export type IrohSession = Pick<
  WasmIrohSession,
  'state' | 'send' | 'nextEvent' | 'shutdown' | 'free' | 'diagnostics'
> & {
  /**
   * Tells the session the network may have changed: it checks its connection at
   * once and drops it if it is dead (instead of waiting for the QUIC idle timeout).
   * Missing in library versions that predate it.
   */
  networkChanged?: () => Promise<void>
  /**
   * The relay the wallet is on, as the session knows it (best while connected).
   * Missing in library versions that predate knocks.
   */
  peerRelay?: () => Promise<string | undefined>
  /**
   * Whether the wallet reports the requests it holds, so one it lost comes back by
   * itself. Missing in library versions that predate it.
   */
  peerReportsRequests?: () => boolean
  /**
   * The dApp request was cancelled: it is not delivered again to a wallet that lost it.
   * Missing in library versions that predate it.
   */
  forgetRequest?: (interactionId: string) => void
}

export type IrohBindings = {
  /** `relayUrl` undefined: n0's public relays, each end its closest one. */
  startSession: (
    password: Uint8Array,
    role: IrohRole,
    relayUrl?: string,
    ackTimeoutMs?: number,
    /** Where the wallet was last seen: the session knocks there as it starts. */
    peerRelayUrl?: string,
    /**
     * This connector is the only holder of the link: a wallet still connected to an earlier
     * run (one that ended without closing, as on a reload) drops it and dials at once.
     * Ignored by library versions that predate it.
     */
    soleHolder?: boolean,
  ) => Promise<IrohSession>
  /** n0's public relays, for display. */
  publicRelayUrls: () => string[]
  /** Why the library cannot use `relayUrl`, or `undefined` if it can. */
  validateRelayUrl: (relayUrl: string) => string | undefined
}

export const irohErrorCodes = {
  invalidPassword: 'invalidPassword',
  invalidRelayUrl: 'invalidRelayUrl',
  bind: 'bind',
  notConnected: 'notConnected',
  timeout: 'timeout',
  messageTooLarge: 'messageTooLarge',
  rejected: 'rejected',
  connectionLost: 'connectionLost',
  closed: 'closed',
  internal: 'internal',
} as const satisfies { [Code in IrohErrorCode]: Code }

/** Rejections of the bindings are `Error`s with an extra `code`. */
export const getIrohErrorCode = (error: unknown): IrohErrorCode | undefined => {
  const code =
    typeof error === 'object' && error !== null
      ? (error as { code?: unknown }).code
      : undefined
  return typeof code === 'string' &&
    Object.prototype.hasOwnProperty.call(irohErrorCodes, code)
    ? (code as IrohErrorCode)
    : undefined
}
