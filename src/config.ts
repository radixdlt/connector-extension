import type { LogLevelNumbers } from 'loglevel'
import packageJson from '../package.json'
import './buffer-shim'
import type { ConnectionConfig } from '@radixdlt/radix-connect-webrtc'
import type { ConnectorExtensionOptions } from 'options'

/** The options that configure the connections: all but the key pair. */
type ConnectionOptions = Omit<
  ConnectorExtensionOptions,
  'publicKey' | 'privateKey'
>
import {
  migrateIrohRelayUrl,
  parseRadixConnectTransport,
} from 'options/radix-connect-transport'
import { includesIroh, isPublicReleaseRef } from './release-channel'
import type { TransportConnectionConfig } from 'chrome/offscreen/wallet-connection/transport/composite-transport'
const { version } = packageJson

const developmentConfig: Required<ConnectionConfig> = {
  iceTransportPolicy: 'all',
  signalingServerBaseUrl:
    'wss://signaling-server-dev.rdx-works-main.extratools.works',
  turnServers: [
    {
      urls: 'turn:turn-dev-udp.rdx-works-main.extratools.works:80?transport=udp',
      username: 'username',
      credential: 'password',
    },
    {
      urls: 'turn:turn-dev-tcp.rdx-works-main.extratools.works:80?transport=tcp',
      username: 'username',
      credential: 'password',
    },
  ],
}

export const radixConnectConfig: Record<string, Required<ConnectionConfig>> = {
  production: {
    iceTransportPolicy: 'all',
    signalingServerBaseUrl: 'wss://signaling-server.radixdlt.com',
    turnServers: [
      {
        urls: 'turn:turn-udp.radixdlt.com:80?transport=udp',
        username: 'username',
        credential: 'password',
      },
      {
        urls: 'turn:turn-tcp.radixdlt.com:80?transport=tcp',
        username: 'username',
        credential: 'password',
      },
    ],
  },
  development: developmentConfig,
  test: developmentConfig,
}

export const mode = import.meta.env.MODE as
  | 'production'
  | 'development'
  | 'test'

const githubRefName = import.meta.env.VITE_GITHUB_REF_NAME || ''

export const isDevMode = import.meta.env.VITE_DEV_TOOLS === 'true'

export const isPublicRelease = isPublicReleaseRef(githubRefName)

/**
 * Whether Radix Connect over iroh is part of this build. vite.config.ts applies the
 * same rule to the CSP and to bundling the wasm module.
 */
export const isIrohAvailable = includesIroh({ githubRefName, isDevMode })

export const defaultRadixConnectConfig = isPublicRelease
  ? 'production'
  : 'development'

export const defaultConnectionConfig: ConnectionConfig = {
  turnServers: radixConnectConfig[defaultRadixConnectConfig].turnServers,
  signalingServerBaseUrl:
    import.meta.env.VITE_APP_SIGNALING_SERVER_BASE_URL ||
    radixConnectConfig[defaultRadixConnectConfig].signalingServerBaseUrl,
}

export const getConnectionConfig = (
  options: ConnectionOptions,
): Required<ConnectionConfig> => {
  if (
    options.radixConnectConfiguration === 'custom' &&
    options.customSignalingServerUrl
  ) {
    const fallback = radixConnectConfig[defaultRadixConnectConfig]
    return {
      signalingServerBaseUrl: options.customSignalingServerUrl,
      turnServers: fallback.turnServers,
      iceTransportPolicy: fallback.iceTransportPolicy,
    }
  }
  return (
    radixConnectConfig[options.radixConnectConfiguration] ??
    radixConnectConfig[defaultRadixConnectConfig]
  )
}

/**
 * Which transports to use and how to configure each of them. Builds without iroh
 * always use WebRTC, whatever the stored options say.
 */
export const getTransportConfig = (
  options: ConnectionOptions,
  irohAvailable = isIrohAvailable,
): TransportConnectionConfig => ({
  transport: irohAvailable
    ? parseRadixConnectTransport(options.radixConnectTransport)
    : 'webrtc',
  webRtc: getConnectionConfig(options),
  // `undefined`: n0's public relays. A custom relay is validated by the iroh
  // transport, which does not connect with an invalid one.
  iroh: { relayUrl: migrateIrohRelayUrl(options.irohRelayUrl) || undefined },
})

// How long the wallet has to confirm a message, whatever the transport.
const messageConfirmationTimeout = 10_000

export const config = {
  /** Of this build (git short hash and build time). */
  buildId: typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'unknown',
  logLevel: (import.meta.env.VITE_APP_LOG_LEVEL || 0) as LogLevelNumbers,
  version,
  secrets: {
    connectionPasswordByteLength: 32,
  },
  links: {
    // How long a forgotten link's notice ("linkRemoved") waits for its wallet: its
    // password is kept until then, and forgotten after.
    removalNoticeLifetime: 30 * 24 * 60 * 60 * 1000,
  },
  messages: {
    // How long a message between the extension's parts waits for its confirmation
    // (e.g. while the offscreen document is not running) before it fails.
    confirmationTimeout: 30_000,
  },
  offscreen: {
    url: 'src/chrome/offscreen/index.html',
  },
  webRTC: {
    isInitiator: true,
    confirmationTimeout: messageConfirmationTimeout,
  },
  iroh: {
    // Applied by the session to every message it sends.
    ackTimeout: messageConfirmationTimeout,
    // Extra time before a send the library never settled is reported as timed out.
    sendSafetyMargin: 5_000,
    // Delay before retrying to start a session that failed to start.
    startRetryDelay: { initial: 1_000, max: 30_000 },
    // Upper bound for closing a session before the next one may start.
    shutdownTimeout: 3_000,
    // How long pairing waits for the wallet to close its iroh connection after
    // linking, so that its confirmation is not cut off.
    linkingGracePeriod: 5_000,
    // The sessions check their connection when the network may have changed: the
    // browser went back online, or the computer woke up (a check timer that ticks
    // every `wakeCheckInterval` saw a real gap above `wakeGapThreshold`). At most
    // one check per `networkChangeDebounce`.
    wakeCheckInterval: 5_000,
    wakeGapThreshold: 15_000,
    networkChangeDebounce: 3_000,
  },
  transport: {
    // With both transports, how long messages go over WebRTC after iroh failed to
    // deliver one (it may still have arrived, so it is not resent at once), unless
    // iroh reconnects first.
    irohHoldBackAfterFailure: 30_000,
    // A message from the wallet identical to one received within this window (e.g.
    // resent over the other transport) is dropped.
    incomingDuplicateWindow: 60_000,
  },
  diagnostics: {
    // The same failure is logged at most once per interval.
    logRepeatInterval: 60_000,
    // Recent events kept per linked wallet, and iroh library warnings kept per page.
    recentEvents: 20,
    irohLibraryEvents: 20,
    // How often the options page refreshes its connection diagnostics.
    refreshInterval: 3_000,
    // How long it waits for the offscreen document to answer.
    requestTimeout: 2_500,
  },
  devTools: {
    url: 'src/chrome/dev-tools/dev-tools.html',
  },
  popup: {
    width: 400,
    height: 600,
    offsetTop: 0,
    pages: {
      pairing: 'src/pairing/index.html',
      ledger: 'src/ledger/index.html',
    },
    closeDelayTime: 700,
  },
}
