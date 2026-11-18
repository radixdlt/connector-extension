import type { ConnectorExtensionOptions } from 'options'
import type {
  LedgerRequest,
  LedgerResponse,
  WalletToExtensionMessage,
} from 'ledger/schemas'
import type {
  Messages,
  MessagePayloads,
  ConfirmationMessageError,
  ConfirmationMessageSuccess,
  MessageSource,
  Message,
  WalletResponseData,
} from './_types'
import type { MessageLifeCycleEvent } from 'chrome/dapp/_types'
import type { ILogObj, ILogObjMeta } from 'tslog/dist/types/interfaces'
import type {
  CancelWalletInteractionExtensionInteraction,
  WalletInteraction,
  WalletInteractionExtensionInteraction,
} from '@radixdlt/radix-dapp-toolkit'
import type { Connections } from 'pairing/state/connections'
import type {
  WalletPublicKey,
  SessionId,
} from 'chrome/offscreen/session-router'
import type {
  PendingRequest,
  RequestOutcomes,
} from 'chrome/offscreen/requests/pending-request'
import type { RequestNotification } from 'chrome/offscreen/requests/request-tracker'
import type { LinkStatuses } from 'chrome/offscreen/link-statuses'
import type { RetiredLink } from 'chrome/links/retired-links'

/** A new message of `discriminator`, with a new id. */
const message = <D extends Exclude<keyof MessagePayloads, 'confirmation'>>(
  discriminator: D,
  source: MessageSource,
  payload: MessagePayloads[D],
) =>
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- TS cannot check the generic union
  ({
    ...payload,
    source,
    discriminator,
    messageId: crypto.randomUUID(),
  }) as Messages[D]

export const createMessage = {
  walletInteraction: (interaction: WalletInteractionExtensionInteraction) =>
    message('walletInteraction', 'contentScript', { interaction }),
  cancelWalletInteraction: (
    interaction: CancelWalletInteractionExtensionInteraction,
  ) => message('cancelWalletInteraction', 'contentScript', { interaction }),
  getSessionRouterData: () => message('getSessionRouterData', 'offScreen', {}),
  setSessionRouterData: (
    data: Record<SessionId, WalletPublicKey>,
    source: MessageSource,
  ) => message('setSessionRouterData', source, { data }),
  log: (log: ILogObjMeta & ILogObj) => message('log', 'any', { log }),
  downloadLogs: () => message('downloadLogs', 'background', {}),
  getConnections: (source: MessageSource) =>
    message('getConnections', source, {}),
  setConnections: (source: MessageSource, connections: Connections) =>
    message('setConnections', source, { connections }),
  setConnectorExtensionOptions: (
    source: MessageSource,
    connectorExtensionOptions: ConnectorExtensionOptions,
  ) =>
    message('setRadixConnectConfiguration', source, {
      connectorExtensionOptions,
    }),
  getExtensionOptions: (source: MessageSource) =>
    message('getExtensionOptions', source, {}),
  focusLedgerTab: () => message('focusLedgerTab', 'ledger', {}),
  dAppRequest: (source: MessageSource, data: WalletInteraction) =>
    message('dAppRequest', source, { data }),
  closeLedgerTab: () => message('closeLedgerTab', 'any', {}),
  walletToLedger: (
    source: MessageSource,
    data: LedgerRequest,
    walletPublicKey: string,
  ) => message('walletToLedger', source, { data, walletPublicKey }),
  walletToExtension: (
    source: MessageSource,
    data: WalletToExtensionMessage,
    walletPublicKey: string,
  ) => message('walletToExtension', source, { data, walletPublicKey }),
  ledgerResponse: (data: LedgerResponse, walletPublicKey: string) =>
    message('ledgerResponse', 'ledger', { data, walletPublicKey }),
  sendMessageToTab: (source: MessageSource, tabId: number, data: Message) =>
    message('sendMessageToTab', source, { data, tabId }),
  // A confirmation answers a message: it keeps that message's id.
  confirmationSuccess: <T = any>(
    source: MessageSource,
    messageId: string,
    data?: T,
  ): ConfirmationMessageSuccess => ({
    source,
    success: true,
    discriminator: 'confirmation',
    messageId,
    data,
  }),
  confirmationError: (
    source: MessageSource,
    messageId: string,
    error: ConfirmationMessageError['error'],
  ): ConfirmationMessageError => ({
    source,
    success: false,
    discriminator: 'confirmation',
    messageId,
    error,
  }),
  walletResponse: (source: MessageSource, data: WalletResponseData) =>
    message('walletResponse', source, { data }),
  sendMessageEventToDapp: (
    source: MessageSource,
    messageEvent: MessageLifeCycleEvent,
    data: { interactionId: string; metadata: { origin: string } },
  ) => message('sendMessageEventToDapp', source, { messageEvent, data }),
  restartConnector: () => message('restartConnector', 'any', {}),
  // Answered by the offscreen document with a `ConnectionDiagnosticsResponse`.
  getConnectionDiagnostics: () =>
    message('getConnectionDiagnostics', 'any', {}),
  // Answered by the offscreen document with a `PendingRequestsResponse`.
  getPendingRequests: () => message('getPendingRequests', 'popup', {}),
  // Sent by the offscreen document whenever a dApp request changes.
  pendingRequestsChanged: (
    requests: PendingRequest[],
    outcomes: RequestOutcomes = {},
  ) => message('pendingRequestsChanged', 'offScreen', { requests, outcomes }),
  // Answered by the offscreen document with `{ cancelled: boolean }`.
  cancelPendingRequest: (interactionId: string) =>
    message('cancelPendingRequest', 'popup', { interactionId }),
  // Answered by the offscreen document with `{ resent: boolean }`.
  resendPendingRequest: (interactionId: string) =>
    message('resendPendingRequest', 'popup', { interactionId }),
  // Answered by the offscreen document with the status of every link.
  getLinkStatuses: () => message('getLinkStatuses', 'popup', {}),
  // Sent by the offscreen document whenever a link's status changes.
  linkStatusesChanged: (statuses: LinkStatuses) =>
    message('linkStatusesChanged', 'offScreen', { statuses }),
  // Answered by the background with the notices still to deliver.
  getRetiredLinks: () => message('getRetiredLinks', 'offScreen', {}),
  setRetiredLinks: (source: MessageSource, links: RetiredLink[]) =>
    message('setRetiredLinks', source, { links }),
  linkRemovalDelivered: (password: string) =>
    message('linkRemovalDelivered', 'offScreen', { password }),
  walletRelaySeen: (walletPublicKey: string, relayUrl: string) =>
    message('walletRelaySeen', 'offScreen', { walletPublicKey, relayUrl }),
  // For the background, which shows the desktop notifications.
  dAppRequestNotification: (notification: RequestNotification) =>
    message('dAppRequestNotification', 'offScreen', { notification }),
} as const
