import type { ResultAsync } from 'neverthrow'
import { NEVER, type Observable } from 'rxjs'

/**
 * Same reasons as the WebRTC transport of `@radixdlt/radix-connect-webrtc` (which
 * does not export them). The request queues build their retry rules on them:
 *
 * - `notConnected`: nothing was sent, the message can be retried or sent through
 *   another transport.
 * - `failedToPrepareMessage`: the message could not be serialized, nothing was sent.
 * - `failedToSendMessage`, `timeout`: the wallet may or may not have received it.
 */
export const messageErrorReasons = {
  notConnected: 'notConnected',
  failedToSendMessage: 'failedToSendMessage',
  failedToPrepareMessage: 'failedToPrepareMessage',
  timeout: 'timeout',
} as const

export type MessageErrorReason = keyof typeof messageErrorReasons

export type SendMessageError = {
  reason: MessageErrorReason
  jsError?: Error
}

export type TransportMessage = Record<string, unknown>

/** A wallet's answer to a dApp request: it names the request it answers. */
export type WalletResponse = TransportMessage & { interactionId: string }

/** Whether a wallet's message names a dApp request, as its answer does. */
export const isWalletResponse = (
  message: TransportMessage,
): message is WalletResponse => typeof message?.interactionId === 'string'

/** What a wallet tells beyond its messages, on transports that carry it (iroh). */
export type WalletNotice =
  /** A request the wallet lost with its app was delivered to it again. */
  | { type: 'requestRedelivered'; interactionId: string }
  /** The wallet's app went to the background, or came back. */
  | { type: 'presence'; inBackground: boolean }
  /**
   * The wallet's app was closed: it said it went to the background, then stopped
   * answering (iroh). Its other transports are dead too: it is the same app.
   */
  | { type: 'walletClosed' }

/**
 * A link to one wallet, identified by the link's connection password.
 *
 * `sendMessage` resolves only once the wallet confirmed it received the message, and
 * fails with `notConnected` right away (without sending anything) while there is no
 * connection.
 */
export type WalletTransport<Config> = {
  connected$: Observable<boolean>
  onMessage$: Observable<TransportMessage>
  /** What the wallet tells beyond its messages; only some transports carry it. */
  walletNotices$?: Observable<WalletNotice>
  /**
   * Whether the wallet reports the requests it holds when it connects, so one it lost
   * with its app comes back by itself (`requestRedelivered`).
   */
  reportsRequests?: () => boolean
  /**
   * The dApp request `interactionId` was cancelled: a transport that sends again by
   * itself the requests a wallet lost (iroh) does not send this one.
   */
  forgetRequest?: (interactionId: string) => void
  /** The network may have changed: a transport that can, checks its connection (iroh). */
  networkChanged?: (reason: string) => void
  setConnectionPassword: (password: Buffer) => ResultAsync<void, Error>
  setConnectionConfig: (config: Config) => void
  sendMessage: (
    message: TransportMessage,
    options?: { timeout?: number },
  ) => ResultAsync<undefined, SendMessageError>
  connect: () => void
  disconnect: () => void
  restart: () => void
  destroy: () => void
}

/** What only some transports do. */
type TransportCapability =
  | 'walletNotices$'
  | 'reportsRequests'
  | 'forgetRequest'
  | 'networkChanged'

/** A transport with every capability: those it lacks do nothing. */
export type CompleteTransport<T extends WalletTransport<never>> = T &
  Required<Pick<WalletTransport<never>, TransportCapability>>

/**
 * `transport`, with the capabilities it lacks doing nothing (no notices, no requests
 * reported, nothing to forget, no network check): its users call them all, without
 * checking which transport it is.
 */
export const withTransportDefaults = <T extends WalletTransport<never>>(
  transport: T,
): CompleteTransport<T> => ({
  ...transport,
  walletNotices$: transport.walletNotices$ ?? NEVER,
  reportsRequests: transport.reportsRequests ?? (() => false),
  forgetRequest: transport.forgetRequest ?? (() => undefined),
  networkChanged: transport.networkChanged ?? (() => undefined),
})
