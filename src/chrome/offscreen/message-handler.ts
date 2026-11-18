import type { WalletPublicKey } from 'chrome/offscreen/session-router'
import type { LogsClient } from './logs-client'
import { ResultAsync, okAsync } from 'neverthrow'
import type { AppLogger } from 'utils/logger'
import { logger as appLogger } from 'utils/logger'
import type { MessageHandler } from '../messages/_types'
import { answer, handleMessages } from '../messages/_types'
import type { WalletConnectionClient } from './wallet-connection/wallet-connection-client'
import { getTransportConfig } from 'config'
import {
  shortWalletKey,
  type ConnectionDiagnosticsResponse,
} from './wallet-connection/transport/diagnostics'
import { irohLibraryEvents } from './wallet-connection/transport/iroh/iroh-library-log'
import { offscreenInstance } from './offscreen-instance'
import { formatDiagnosticsReport } from 'options/diagnostics-report'
import { config } from 'config'
import type { ConnectorExtensionOptions } from 'options'
import type { Connection, Connections } from 'pairing/state/connections'
import type {
  OffscreenServices,
  walletConnectionClientFactory,
} from './wallet-connection/factory'
import type { LinkRemovalNotices } from './link-removal-notices'
import type { RetiredLink } from 'chrome/links/retired-links'
import { defaultPendingRequestExpiry } from './requests/pending-request'
import { DAppRequestDispatcher } from './requests/dapp-request-dispatcher'

export type OffscreenMessageHandler = ReturnType<typeof OffscreenMessageHandler>
export const OffscreenMessageHandler = (input: {
  logsClient: LogsClient
  connectionsMap: Map<string, WalletConnectionClient>
  walletConnectionClientFactory: walletConnectionClientFactory
  logger?: AppLogger
  /** What the wallet links share: the same the factory gives them. */
  services: Pick<
    OffscreenServices,
    'requestTracker' | 'linkStatusTracker' | 'sessionRouter'
  >
  /** Tells the wallets of forgotten links (none in tests that do not need it). */
  linkRemovalNotices?: LinkRemovalNotices
}): MessageHandler => {
  const {
    requestTracker,
    linkStatusTracker: linkStatuses,
    sessionRouter,
  } = input.services
  let currentExtensionOptions: ConnectorExtensionOptions | undefined
  const logsClient = input.logsClient
  const notices = input.linkRemovalNotices
  // The notices to deliver, and the passwords of the open wallet links: a notice
  // waits until its link is no longer open (see `LinkRemovalNotices`).
  let retiredLinks: RetiredLink[] = []
  let openPasswords = new Set<string>()
  const updateNotices = () => notices?.update(retiredLinks, openPasswords)
  const logger = input.logger
  const connectionsMap = input.connectionsMap

  // Whether the links of this offscreen document were opened yet: the first time,
  // they are (re)opened because the document started.
  let linksOpened = false

  const destroyNonExistingConnections = (connections: Connections) => {
    // Destroy & remove "WalletConnectionClient"s which do not have corresponding entry in connections configuration
    // This happens when user clicks "forget wallet"
    Array.from(connectionsMap.entries()).forEach(([id, connection]) => {
      if (!connections[id]) {
        logger?.info('closing a wallet link: the wallet was forgotten', {
          wallet: shortWalletKey(id),
        })
        connection.destroy()
        linkStatuses.forget(id)
        connectionsMap.delete(id)
      }
    })
  }

  /**
   * Two links with the same password would run two endpoints with the same keys,
   * which displace each other. Wallets are named by their short keys.
   */
  const warnAboutSharedPasswords = (connections: Connections) => {
    const byPassword = new Map<string, string[]>()
    for (const [id, connection] of Object.entries(connections)) {
      if (!connection?.password) continue
      byPassword.set(connection.password, [
        ...(byPassword.get(connection.password) ?? []),
        shortWalletKey(id),
      ])
    }
    for (const wallets of byPassword.values())
      if (wallets.length > 1)
        logger?.warn(
          'several linked wallets share one link password: their connections displace each other',
          { wallets: wallets.join(', ') },
        )
  }

  const diagnosticsResponse = (): ResultAsync<
    ConnectionDiagnosticsResponse,
    never
  > =>
    ResultAsync.combine(
      Array.from(connectionsMap.values(), (connection) =>
        connection.diagnosticsWithQueues(),
      ),
    ).map((connections) => ({
      connections,
      offscreen: offscreenInstance(),
      irohLibraryEvents: irohLibraryEvents.list(),
    }))

  // The dApp requests: from their tabs to the links, and the answers back.
  const dispatcher = DAppRequestDispatcher({
    links: connectionsMap,
    requestTracker,
    sessionRouter,
    logger: logger ?? appLogger,
    expiry: () =>
      currentExtensionOptions?.pendingRequestExpiry ??
      defaultPendingRequestExpiry,
  })

  const extensionVersion = () => {
    try {
      const manifest = chrome.runtime.getManifest()
      return manifest.version_name ?? manifest.version
    } catch (error) {
      return config.version
    }
  }

  const updateWalletConnectionClient = (
    id: WalletPublicKey,
    connection: Connection,
  ) => {
    const connectionClient = connectionsMap.get(id) as WalletConnectionClient
    connectionClient.update(connection)
  }

  const createWalletConnectionClient = (
    id: WalletPublicKey,
    connection: Connection,
  ) => {
    logger?.debug(
      'Creating WalletConnectionClient',
      connection.walletName,
      connection.walletPublicKey,
    )
    logger?.info('opening a wallet link', {
      wallet: shortWalletKey(id),
      reason: linksOpened
        ? 'a wallet was linked'
        : 'the offscreen document started',
    })

    const client = input.walletConnectionClientFactory({
      connection,
      logger: input.logger || appLogger,
      connectorExtensionOptions: currentExtensionOptions,
      dispatch: dispatcher.linkDispatch,
    })
    connectionsMap.set(id, client)
    // Factories of tests may give clients without it.
    if (client.sendingVia$) linkStatuses.follow(id, client.sendingVia$)
  }

  const updateConnectionsMap = (connections: Connections) => {
    Object.entries(connections).forEach(([id, connection]) => {
      if (connectionsMap.has(id)) {
        updateWalletConnectionClient(id, connection)
      } else {
        createWalletConnectionClient(id, connection)
      }
    })
  }

  return handleMessages({
    setConnections: (message) => {
      const { connections } = message
      warnAboutSharedPasswords(connections ?? {})
      updateConnectionsMap(connections)
      destroyNonExistingConnections(connections)
      sessionRouter.setLinkedWallets(Object.keys(connections ?? {}))
      openPasswords = new Set(
        Object.values(connections ?? {}).map(
          (connection) => connection.password,
        ),
      )
      updateNotices()
      if (!linksOpened)
        logger?.info('wallet links opened', {
          links: connectionsMap.size,
          ...offscreenInstance(),
        })
      linksOpened = true
      return okAsync({ sendConfirmation: true })
    },
    restartConnector: () => {
      logger?.info(
        'the computer is active again: restarting idle wallet links',
        { links: connectionsMap.size },
      )
      for (const [, connection] of connectionsMap) {
        connection.restart()
      }
      return okAsync({ sendConfirmation: true })
    },
    getConnectionDiagnostics: (message) =>
      diagnosticsResponse().map((data) => answer(message, data)),
    getLinkStatuses: (message) =>
      okAsync(answer(message, { statuses: linkStatuses.list() })),
    getPendingRequests: (message) =>
      okAsync(answer(message, { requests: requestTracker.list() })),
    cancelPendingRequest: (message) =>
      dispatcher
        .cancel(message.interactionId)
        .map((data) => answer(message, data)),
    resendPendingRequest: (message) =>
      dispatcher
        .resend(message.interactionId)
        .map((data) => answer(message, data)),
    // A ledger device's response, for the wallet that asked for it.
    ledgerResponse: (message) => {
      const link = Array.from(connectionsMap.values()).find(
        (connection) => connection.walletPublicKey === message.walletPublicKey,
      )
      if (!link) return okAsync({ sendConfirmation: false })
      return link
        .sendLedgerResponse(message.data)
        .map(() => ({ sendConfirmation: false }))
    },
    setRadixConnectConfiguration: (message) => {
      const { connectorExtensionOptions } = message
      currentExtensionOptions = connectorExtensionOptions
      logger?.info('options received', {
        transport: connectorExtensionOptions?.radixConnectTransport,
        irohRelay: connectorExtensionOptions?.irohRelayUrl
          ? 'custom'
          : 'public',
        links: connectionsMap.size,
      })

      // Also reaches clients created before the options were known: they do not
      // connect until they get their first configuration.
      const transportConfig = getTransportConfig(connectorExtensionOptions)
      for (const [, connection] of connectionsMap) {
        connection.setConnectionConfig(transportConfig)
      }
      notices?.setConnectionConfig(transportConfig)

      return okAsync({ sendConfirmation: true })
    },
    setRetiredLinks: (message) => {
      retiredLinks = message.links
      updateNotices()
      return okAsync({ sendConfirmation: true })
    },
    setSessionRouterData: (message) => {
      const { data } = message
      logger?.info('setSessionRouterData', message)
      sessionRouter.refreshStore(data || {})
      return okAsync({ sendConfirmation: true })
    },
    downloadLogs: () => {
      // The current diagnostics first.
      diagnosticsResponse().map((diagnostics) =>
        logsClient.download(
          formatDiagnosticsReport({
            generatedAt: new Date(),
            extensionVersion: extensionVersion(),
            browser: navigator.userAgent,
            ...diagnostics,
          }),
        ),
      )
      return okAsync({ sendConfirmation: false })
    },
    log: (message) => {
      logsClient.add(message.log)
      return okAsync({ sendConfirmation: false })
    },
  })
}
