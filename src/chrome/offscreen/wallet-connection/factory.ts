import { transportSlots } from './transport/transport-slots'
import { logger as appLogger, type AppLogger } from 'utils/logger'
import { RequestTracker } from '../requests/request-tracker'
import { LinkStatusTracker } from '../link-statuses'
import { sendMessage } from 'chrome/helpers/send-message'
import { createMessage } from 'chrome/messages/create-message'
import {
  WalletConnectionClient,
  type WalletConnectionTransport,
} from './wallet-connection-client'
import { getTransportConfig } from 'config'
import type { Connection } from 'pairing/state/connections'
import { SessionRouter } from '../session-router'
import type { ConnectorExtensionOptions } from 'options'
import { createWebRtcTransport } from './transport/webrtc-transport'
import { IrohTransport } from './transport/iroh/iroh-transport'
import { CompositeTransport } from './transport/composite-transport'
import { shortWalletKey } from './transport/diagnostics'
import type { LinkDispatch } from '../requests/dapp-request-dispatcher'

/**
 * What the wallet links of an offscreen document share, made once by the document
 * (and by each test that needs them): never a module's own, shared by whoever imports it.
 */
export type OffscreenServices = {
  /**
   * The dApp requests of every link: pushed to the open popup or side panel, and to
   * the background for the desktop notifications.
   */
  requestTracker: RequestTracker
  /** The status of every link: pushed to the open popup or side panel. */
  linkStatusTracker: LinkStatusTracker
  /** Which wallet each dApp session is with. */
  sessionRouter: SessionRouter
}

export const OffscreenServices = (): OffscreenServices => ({
  requestTracker: RequestTracker({
    logger: appLogger.getSubLogger({ name: 'requests' }),
    onChange: (requests, outcomes) =>
      sendMessage(createMessage.pendingRequestsChanged(requests, outcomes)),
    onNotification: (notification) =>
      sendMessage(createMessage.dAppRequestNotification(notification)),
  }),
  linkStatusTracker: LinkStatusTracker({
    onChange: (statuses) =>
      sendMessage(createMessage.linkStatusesChanged(statuses)),
  }),
  sessionRouter: SessionRouter(),
})

/**
 * The transport of a link, as its options select it (WebRTC, iroh or both): the
 * same for a wallet's link and for the notice of a forgotten one.
 */
/**
 * `link`: the relay its wallet was last seen on over iroh, and where to tell a new
 * one, so that each iroh session knocks where the wallet is.
 */
export const createLinkTransport = (
  logger: AppLogger,
  link: {
    walletRelay?: string
    onWalletRelay?: (relayUrl: string) => void
  } = {},
) =>
  CompositeTransport({
    slots: transportSlots({
      webRtc: createWebRtcTransport(logger),
      createIrohTransport: () =>
        IrohTransport({
          logger: logger.getSubLogger({ name: 'iroh' }),
          walletRelay: link.walletRelay,
          onWalletRelay: link.onWalletRelay,
        }),
    }),
    logger,
  })

export type walletConnectionClientFactory = ReturnType<
  typeof WalletConnectionClientFactory
>

/** Opens the wallet links of an offscreen document, with what they share. */
export const WalletConnectionClientFactory =
  (services: OffscreenServices) =>
  (input: {
    connection: Connection
    logger: AppLogger
    radixConnectConfiguration?: string
    connectorExtensionOptions?: ConnectorExtensionOptions
    /** The offscreen document's `DAppRequestDispatcher`. */
    dispatch: LinkDispatch
    transport?: WalletConnectionTransport
    // The offscreen document's unless given (tests).
    requestTracker?: RequestTracker
  }): WalletConnectionClient => {
    // Every log of this link, the transports' included, starts with the short form
    // of the wallet's public key. Not the link's name: users choose it, and logs are
    // shared.
    const logger = input.logger.getSubLogger({
      name: '[WCC]',
      prefix: [`wallet=${shortWalletKey(input.connection.walletPublicKey)}`],
    })

    const walletPublicKey = input.connection.walletPublicKey
    const transport =
      input.transport ||
      createLinkTransport(logger, {
        walletRelay: input.connection.walletRelay,
        onWalletRelay: (relayUrl) =>
          sendMessage(createMessage.walletRelaySeen(walletPublicKey, relayUrl)),
      })

    const client = WalletConnectionClient({
      transport,
      connectionPassword: input.connection.password,
      walletPublicKey: input.connection.walletPublicKey,
      walletName: input.connection.walletName,
      logger,
      requestTracker: input.requestTracker ?? services.requestTracker,
      dispatch: input.dispatch,
    })

    if (input.connectorExtensionOptions) {
      client.setConnectionConfig(
        getTransportConfig(input.connectorExtensionOptions),
      )
    } else if (input.radixConnectConfiguration) {
      client.setConnectionConfig(
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- only radixConnectConfiguration is read
        getTransportConfig({
          radixConnectConfiguration: input.radixConnectConfiguration,
        } as ConnectorExtensionOptions),
      )
    }
    return client
  }
