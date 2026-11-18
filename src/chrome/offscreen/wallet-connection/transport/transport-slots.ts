import { okAsync, type ResultAsync } from 'neverthrow'
import {
  usesIroh,
  usesWebRtc,
  type RadixConnectTransport,
} from 'options/radix-connect-transport'
import type { ConnectionConfig } from '@radixdlt/radix-connect-webrtc'
import {
  withTransportDefaults,
  type CompleteTransport,
  type WalletTransport,
} from './wallet-transport'
import type { WebRtcTransport } from './webrtc-transport'
import type { IrohConnectionConfig, IrohTransport } from './iroh/iroh-transport'
import type { TransportName } from './diagnostics'

export type TransportConnectionConfig = {
  transport: RadixConnectTransport
  webRtc: ConnectionConfig
  iroh: IrohConnectionConfig
}

/**
 * What a link needs of each of its transports: those it lacks do nothing. It is given
 * the link's whole configuration, and takes its own part of it.
 */
export type LinkTransport = CompleteTransport<
  WalletTransport<TransportConnectionConfig> & {
    diagnostics: () => unknown
    /** Closes the transport's endpoint for good (see `releaseIroh`). */
    shutdown: () => ResultAsync<void, never>
    /** Why its connection to the wallet ended, if it knows. */
    disconnectReason: () => string | undefined
  }
>

/**
 * One transport of a link: when the option selects it, its configuration, and how
 * it ranks for sending.
 */
export type TransportSlot = {
  name: TransportName
  /** For log messages. */
  label: string
  isSelectedBy: (mode: RadixConnectTransport) => boolean
  /**
   * Sends first while it is connected, unless it just failed to deliver a message
   * and another transport is connected. The others send in their order.
   */
  preferred: boolean
  /** It checks its connection when the network may have changed (see `networkChanged`). */
  checksNetwork: boolean
  /**
   * Created the first time it is selected, then reused (and given the password
   * again with each configuration); otherwise created with the link.
   */
  create: () => LinkTransport
  lazy: boolean
}

/**
 * Only what every transport has, plus the `extras` its slot names: a transport's
 * other methods are not used by accident. `configOf`: its part of the link's
 * configuration.
 */
export const linkTransport = <Config>(
  transport: WalletTransport<Config> & { diagnostics: () => unknown },
  configOf: (config: TransportConnectionConfig) => Config,
  extras: Partial<Pick<LinkTransport, 'shutdown' | 'disconnectReason'>> = {},
): LinkTransport =>
  withTransportDefaults({
    connected$: transport.connected$,
    onMessage$: transport.onMessage$,
    walletNotices$: transport.walletNotices$,
    reportsRequests: transport.reportsRequests,
    forgetRequest: transport.forgetRequest,
    networkChanged: transport.networkChanged,
    setConnectionPassword: transport.setConnectionPassword,
    setConnectionConfig: (config: TransportConnectionConfig) =>
      transport.setConnectionConfig(configOf(config)),
    sendMessage: transport.sendMessage,
    connect: transport.connect,
    disconnect: transport.disconnect,
    restart: transport.restart,
    destroy: transport.destroy,
    diagnostics: transport.diagnostics,
    shutdown: extras.shutdown ?? (() => okAsync(undefined)),
    disconnectReason: extras.disconnectReason ?? (() => undefined),
  })

/**
 * A link's transports, by preference: iroh, then WebRTC. A new transport is one more
 * slot here (and a `TransportName`, and its part of `TransportConnectionConfig`).
 */
export const transportSlots = (input: {
  webRtc: WebRtcTransport
  createIrohTransport: () => IrohTransport
}): TransportSlot[] => [
  {
    name: 'iroh',
    label: 'iroh',
    isSelectedBy: usesIroh,
    preferred: true,
    checksNetwork: true,
    lazy: true,
    create: () => {
      const iroh = input.createIrohTransport()
      return linkTransport(iroh, (config) => config.iroh, {
        shutdown: iroh.shutdown,
        disconnectReason: () => iroh.diagnostics().session?.lastError,
      })
    },
  },
  {
    name: 'webrtc',
    label: 'WebRTC',
    isSelectedBy: usesWebRtc,
    preferred: false,
    checksNetwork: false,
    lazy: false,
    create: () => linkTransport(input.webRtc, (config) => config.webRtc),
  },
]
