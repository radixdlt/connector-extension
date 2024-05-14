import { ConnectorExtensionOptions } from './../../options/index'
import {
  AccountListMessage,
  LedgerRequest,
  LedgerResponse,
  LinkClientInteraction,
} from 'ledger/schemas'
import {
  Messages,
  ConfirmationMessageError,
  ConfirmationMessageSuccess,
  MessageSource,
  Message,
  messageDiscriminator,
  messageSource,
} from './_types'
import { MessageLifeCycleEvent } from 'chrome/dapp/_types'
import { ILogObj, ILogObjMeta } from 'tslog/dist/types/interfaces'
import {
  CancelWalletInteractionExtensionInteraction,
  WalletInteraction,
  WalletInteractionExtensionInteraction,
} from '@radixdlt/radix-dapp-toolkit'
import { Connections } from 'pairing/state/connections'
import { WalletPublicKey, SessionId } from 'chrome/offscreen/session-router'

export const createMessage = {
  openParingPopup: () => ({
    messageId: crypto.randomUUID(),
    source: messageSource.contentScript,
    discriminator: messageDiscriminator.openParingPopup,
  }),
  walletInteraction: (interaction: WalletInteractionExtensionInteraction) => ({
    messageId: crypto.randomUUID(),
    discriminator: messageDiscriminator.walletInteraction,
    source: messageSource.contentScript,
    interaction,
  }),
  cancelWalletInteraction: (
    interaction: CancelWalletInteractionExtensionInteraction,
  ) => ({
    messageId: crypto.randomUUID(),
    discriminator: messageDiscriminator.cancelWalletInteraction,
    source: messageSource.contentScript,
    interaction,
  }),
  getSessionRouterData: () => ({
    messageId: crypto.randomUUID(),
    discriminator: messageDiscriminator.getSessionRouterData,
    source: messageSource.offScreen,
  }),
  setSessionRouterData: (
    data: Record<SessionId, WalletPublicKey>,
    source: MessageSource,
  ) => ({
    source,
    messageId: crypto.randomUUID(),
    discriminator: messageDiscriminator.setSessionRouterData,
    data,
  }),
  extensionStatus: (isWalletLinked: boolean) => ({
    eventType: 'extensionStatus',
    isExtensionAvailable: true,
    isWalletLinked,
    canHandleSessions: true,
  }),
  log: (log: ILogObjMeta & ILogObj): Messages['log'] => ({
    source: 'any',
    discriminator: 'log',
    messageId: crypto.randomUUID(),
    log,
  }),
  downloadLogs: (): Messages['downloadLogs'] => ({
    source: 'background',
    discriminator: 'downloadLogs',
    messageId: crypto.randomUUID(),
  }),
  getConnections: (source: MessageSource): Messages['getConnections'] => ({
    discriminator: 'getConnections',
    messageId: crypto.randomUUID(),
    source,
  }),
  setConnections: (
    source: MessageSource,
    connections: Connections,
  ): Messages['setConnections'] => ({
    discriminator: 'setConnections',
    messageId: crypto.randomUUID(),
    connections,
    source,
  }),
  setConnectorExtensionOptions: (
    source: MessageSource,
    connectorExtensionOptions: ConnectorExtensionOptions,
  ) => ({
    discriminator: messageDiscriminator.setRadixConnectConfiguration,
    messageId: crypto.randomUUID(),
    connectorExtensionOptions,
    source,
  }),
  getExtensionOptions: (
    source: MessageSource,
  ): Messages['getExtensionOptions'] => ({
    discriminator: 'getExtensionOptions',
    messageId: crypto.randomUUID(),
    source,
  }),
  focusLedgerTab: (): Messages['focusLedgerTab'] => ({
    source: 'ledger',
    discriminator: messageDiscriminator.focusLedgerTab,
    messageId: crypto.randomUUID(),
  }),
  detectWalletLink: (source: MessageSource): Messages['detectWalletLink'] => ({
    source,
    discriminator: 'detectWalletLink',
    messageId: crypto.randomUUID(),
  }),
  dAppRequest: (
    source: MessageSource,
    data: WalletInteraction,
  ): Messages['dAppRequest'] => ({
    source,
    discriminator: 'dAppRequest',
    messageId: crypto.randomUUID(),
    data,
  }),
  walletMessage: (
    source: MessageSource,
    message: Record<string, any>,
  ): Messages['walletMessage'] => ({
    source,
    discriminator: 'walletMessage',
    messageId: crypto.randomUUID(),
    data: message,
  }),
  closeLedgerTab: (): Messages['closeLedgerTab'] => ({
    source: 'any',
    discriminator: 'closeLedgerTab',
    messageId: crypto.randomUUID(),
  }),
  closeDappTab: (
    source: MessageSource,
    tabId: number,
  ): Messages['closeDappTab'] => ({
    source,
    tabId,
    discriminator: 'closeDappTab',
    messageId: crypto.randomUUID(),
  }),
  walletToLedger: (
    source: MessageSource,
    message: LedgerRequest,
  ): Messages['walletToLedger'] => ({
    source,
    discriminator: messageDiscriminator.walletToLedger,
    messageId: crypto.randomUUID(),
    data: message,
  }),
  walletToExtension: (
    source: MessageSource,
    message: AccountListMessage | LinkClientInteraction,
    walletPublicKey: string,
  ): Messages['walletToExtension'] => ({
    source,
    discriminator: messageDiscriminator.walletToExtension,
    messageId: crypto.randomUUID(),
    walletPublicKey,
    data: message,
  }),
  ledgerResponse: (message: LedgerResponse): Messages['ledgerResponse'] => ({
    source: 'ledger',
    discriminator: messageDiscriminator.ledgerResponse,
    messageId: crypto.randomUUID(),
    data: message,
  }),
  sendMessageToTab: (
    source: MessageSource,
    tabId: number,
    data: Message,
  ): Messages['sendMessageToTab'] => ({
    source,
    discriminator: 'sendMessageToTab',
    messageId: crypto.randomUUID(),
    data,
    tabId,
  }),
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
  walletResponse: (
    source: MessageSource,
    data: Record<string, any>,
  ): Messages['walletResponse'] => ({
    source,
    discriminator: 'walletResponse',
    messageId: crypto.randomUUID(),
    data,
  }),
  incomingDappMessage: (
    source: MessageSource,
    data: Record<string, any>,
  ): Messages['incomingDappMessage'] => ({
    source,
    discriminator: 'incomingDappMessage',
    messageId: crypto.randomUUID(),
    data,
  }),
  incomingWalletMessage: (
    source: MessageSource,
    data: Record<string, any>,
  ): Messages['incomingWalletMessage'] => ({
    source,
    discriminator: 'incomingWalletMessage',
    messageId: crypto.randomUUID(),
    data,
  }),
  sendMessageEventToDapp: (
    source: MessageSource,
    messageEvent: MessageLifeCycleEvent,
    data: { interactionId: string; metadata: { origin: string } },
  ): Messages['sendMessageEventToDapp'] => ({
    source,
    discriminator: 'sendMessageEventToDapp',
    messageId: crypto.randomUUID(),
    messageEvent,
    data,
  }),
  restartConnector: (): Messages['restartConnector'] => ({
    source: 'any',
    discriminator: 'restartConnector',
    messageId: crypto.randomUUID(),
  }),
} as const
