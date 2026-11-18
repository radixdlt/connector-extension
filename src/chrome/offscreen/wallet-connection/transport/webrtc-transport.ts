import {
  ConnectorClient,
  type ConnectionConfig,
} from '@radixdlt/radix-connect-webrtc'
import { config } from 'config'
import type { AppLogger } from 'utils/logger'
import type { WalletTransport } from './wallet-transport'

export type WebRtcTransport = WalletTransport<ConnectionConfig>

/**
 * The WebRTC transport: the `ConnectorClient` of `@radixdlt/radix-connect-webrtc`,
 * created as the extension always did, which already has the shape of a
 * `WalletTransport`. The full client is returned because pairing also needs
 * `generateConnectionPassword` and `connectionPassword$`.
 */
export const createWebRtcTransport = (logger: AppLogger) =>
  ConnectorClient({
    source: 'extension',
    target: 'wallet',
    isInitiator: config.webRTC.isInitiator,
    logger,
    negotiationTimeout: 10_000,
  })
