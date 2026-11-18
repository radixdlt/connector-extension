import {
  ConnectorClient,
  type ConnectionConfig,
} from '@radixdlt/radix-connect-webrtc'
import { filter, map, type Observable } from 'rxjs'
import { config } from 'config'
import type { AppLogger } from 'utils/logger'
import type { WebRtcDiagnostics } from './diagnostics'
import type {
  TransportMessage,
  WalletNotice,
  WalletTransport,
} from './wallet-transport'
import { WebRtcDiagnosticsTracker } from './webrtc-diagnostics'

export type WebRtcTransport = WalletTransport<ConnectionConfig> & {
  diagnostics: () => WebRtcDiagnostics
}

const negotiationTimeout = 10_000

/**
 * A wallet telling whether its app is in the background (`walletPresence`), or which
 * requests it still has (`walletRequests`, on every channel it opens): sent by wallets
 * that support them, notices for the extension, never messages for a dApp.
 */
type Presence = TransportMessage & {
  discriminator: 'walletPresence'
  inBackground: boolean
}
type HeldRequests = TransportMessage & {
  discriminator: 'walletRequests'
  interactionIds: string[]
}

const isPresence = (message: TransportMessage): message is Presence =>
  message?.discriminator === 'walletPresence' &&
  typeof message.inBackground === 'boolean'

const isHeldRequests = (message: TransportMessage): message is HeldRequests =>
  message?.discriminator === 'walletRequests' &&
  Array.isArray(message.interactionIds) &&
  message.interactionIds.every((id: unknown) => typeof id === 'string')

/**
 * The wallet's messages for the dApps, and its notices, apart. `connectedSince` is
 * when the current connection opened: what a `walletRequests` describes.
 */
export const splitWalletNotices = (
  messages$: Observable<TransportMessage>,
  connectedSince: () => number,
) => ({
  messages$: messages$.pipe(
    filter((message) => !isPresence(message) && !isHeldRequests(message)),
  ),
  notices$: messages$.pipe(
    filter(
      (message): message is Presence | HeldRequests =>
        isPresence(message) || isHeldRequests(message),
    ),
    map(
      (message): WalletNotice =>
        isPresence(message)
          ? { type: 'presence', inBackground: message.inBackground }
          : {
              type: 'requestsHeld',
              interactionIds: message.interactionIds,
              since: connectedSince(),
            },
    ),
  ),
})

/** The library logs every data channel chunk (as JSON text) while debugging. */
/**
 * The WebRTC transport is the `ConnectorClient` of `@radixdlt/radix-connect-webrtc`,
 * which already has the shape of a `WalletTransport`, plus its diagnostics. The full
 * client is returned because pairing also needs `generateConnectionPassword` and
 * `connectionPassword$`.
 */
export const createWebRtcTransport = (parentLogger: AppLogger) => {
  const logger = parentLogger.getSubLogger({ name: 'webrtc' })
  const tracker = WebRtcDiagnosticsTracker({
    logger,
    negotiationTimeoutMs: negotiationTimeout,
    logRepeatIntervalMs: config.diagnostics.logRepeatInterval,
  })
  const client = ConnectorClient({
    source: 'extension',
    target: 'wallet',
    isInitiator: config.webRTC.isInitiator,
    logger,
    negotiationTimeout,
    createSignalingSubjects: tracker.createSignalingSubjects,
    createWebRtcSubjects: tracker.createWebRtcSubjects,
  })
  // The config last passed to the library, serialised.
  let appliedConfig: string | undefined
  // When the current connection to the wallet opened.
  let connectedSince = Date.now()
  // Whether the wallet tells which requests it still has (it says so on every channel).
  let reportsRequests = false
  const subscription = client.connected$.subscribe((connected) => {
    if (connected) connectedSince = Date.now()
    tracker.setConnected(connected)
  })
  const fromWallet = splitWalletNotices(client.onMessage$, () => connectedSince)
  subscription.add(
    fromWallet.notices$.subscribe((notice) => {
      if (notice.type === 'requestsHeld') reportsRequests = true
    }),
  )

  return {
    ...client,
    onMessage$: fromWallet.messages$,
    walletNotices$: fromWallet.notices$,
    reportsRequests: () => reportsRequests,
    setConnectionConfig: (connectionConfig: ConnectionConfig) => {
      // The library rebuilds the connection on every config it is given: saving any
      // option (a theme, a notification) restarted every link, and a request in
      // flight timed out. Only a config that changed is passed on.
      const serialized = JSON.stringify(connectionConfig)
      if (serialized === appliedConfig) return
      appliedConfig = serialized
      tracker.setSignalingServer(connectionConfig.signalingServerBaseUrl)
      client.setConnectionConfig(connectionConfig)
    },
    diagnostics: tracker.diagnostics,
    destroy: () => {
      subscription.unsubscribe()
      tracker.destroy()
      client.destroy()
    },
  } satisfies WebRtcTransport
}
