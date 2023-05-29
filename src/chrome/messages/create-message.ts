import { LedgerRequest, LedgerResponse } from 'ledger/schemas'
import {
  Messages,
  ConfirmationMessageError,
  ConfirmationMessageSuccess,
  MessageSource,
  Message,
  messageDiscriminator,
} from './_types'
import { MessageLifeCycleEvent } from 'chrome/dapp/_types'

export const createMessage = {
  setConnectionPassword: (
    source: MessageSource,
    connectionPassword?: string
  ): Messages['setConnectionPassword'] => ({
    discriminator: 'setConnectionPassword',
    messageId: crypto.randomUUID(),
    connectionPassword,
    source,
  }),
  getConnectionPassword: (
    source: MessageSource
  ): Messages['getConnectionPassword'] => ({
    discriminator: 'getConnectionPassword',
    messageId: crypto.randomUUID(),
    source,
  }),
  detectWalletLink: (source: MessageSource): Messages['detectWalletLink'] => ({
    source,
    discriminator: 'detectWalletLink',
    messageId: crypto.randomUUID(),
  }),
  dAppRequest: (source: MessageSource, data: any): Messages['dAppRequest'] => ({
    source,
    discriminator: 'dAppRequest',
    messageId: crypto.randomUUID(),
    data,
  }),
  walletMessage: (
    source: MessageSource,
    message: any
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
    tabId: number
  ): Messages['closeDappTab'] => ({
    source,
    tabId,
    discriminator: 'closeDappTab',
    messageId: crypto.randomUUID(),
  }),
  walletToLedger: (
    source: MessageSource,
    message: LedgerRequest
  ): Messages['walletToLedger'] => ({
    source,
    discriminator: messageDiscriminator.walletToLedger,
    messageId: crypto.randomUUID(),
    data: message,
  }),
  convertPopupToTab: (message: Messages['walletToLedger']) => ({
    source: 'popup',
    discriminator: messageDiscriminator.convertPopupToTab,
    messageId: crypto.randomUUID(),
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
    data: Message
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
    data?: T
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
    error: ConfirmationMessageError['error']
  ): ConfirmationMessageError => ({
    source,
    success: false,
    discriminator: 'confirmation',
    messageId,
    error,
  }),
  walletResponse: (
    source: MessageSource,
    data: Record<string, any>
  ): Messages['walletResponse'] => ({
    source,
    discriminator: 'walletResponse',
    messageId: crypto.randomUUID(),
    data,
  }),
  incomingDappMessage: (
    source: MessageSource,
    data: Record<string, any>
  ): Messages['incomingDappMessage'] => ({
    source,
    discriminator: 'incomingDappMessage',
    messageId: crypto.randomUUID(),
    data,
  }),
  incomingWalletMessage: (
    source: MessageSource,
    data: Record<string, any>
  ): Messages['incomingWalletMessage'] => ({
    source,
    discriminator: 'incomingWalletMessage',
    messageId: crypto.randomUUID(),
    data,
  }),
  sendMessageEventToDapp: (
    source: MessageSource,
    messageEvent: MessageLifeCycleEvent,
    interactionId: string
  ): Messages['sendMessageEventToDapp'] => ({
    source,
    discriminator: 'sendMessageEventToDapp',
    messageId: crypto.randomUUID(),
    messageEvent,
    interactionId,
  }),
} as const
