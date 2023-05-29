import { MessageLifeCycleEvent } from 'chrome/dapp/_types'
import { LedgerRequest, LedgerResponse } from 'ledger/schemas'
import { ResultAsync } from 'neverthrow'

export const messageDiscriminator = {
  getConnectionPassword: 'getConnectionPassword',
  setConnectionPassword: 'setConnectionPassword',
  dAppRequest: 'dAppRequest',
  closeLedgerTab: 'closeLedgerTab',
  closeDappTab: 'closeDappTab',
  ledgerResponse: 'ledgerResponse',
  walletToLedger: 'walletToLedger',
  convertPopupToTab: 'convertPopupToTab',
  walletResponse: 'walletResponse',
  toContentScript: 'toContentScript',
  walletMessage: 'walletMessage',
  sendMessageToTab: 'sendMessageToTab',
  detectWalletLink: 'detectWalletLink',
  confirmation: 'confirmation',
  incomingDappMessage: 'incomingDappMessage',
  incomingWalletMessage: 'incomingWalletMessage',
  sendMessageEventToDapp: 'sendMessageEventToDapp',
} as const

export type MessageDiscriminator = typeof messageDiscriminator

export const messageSource = {
  offScreen: 'offScreen',
  background: 'background',
  contentScript: 'contentScript',
  dApp: 'dapp',
  ledger: 'ledger',
  wallet: 'wallet',
  any: 'any',
} as const

export type MessageSource = keyof typeof messageSource

export type MessageBuilder<
  D extends keyof typeof messageDiscriminator,
  Content
> = {
  source: MessageSource
  discriminator: D
  messageId: string
} & Content

export type ConfirmationMessageSuccess<T = any> = MessageBuilder<
  MessageDiscriminator['confirmation'],
  { success: true; data: T }
>
export type ConfirmationMessageError = MessageBuilder<
  MessageDiscriminator['confirmation'],
  {
    success: false
    error: { reason: string; message?: string; jsError?: Error }
  }
>

export type SendMessageWithConfirmation<T = any> = (
  message: Message,
  tabId?: number
) => ResultAsync<
  ConfirmationMessageSuccess<T>['data'],
  ConfirmationMessageError['error']
>

export type Messages = {
  [messageDiscriminator.confirmation]:
    | ConfirmationMessageSuccess
    | ConfirmationMessageError

  [messageDiscriminator.sendMessageEventToDapp]: MessageBuilder<
    MessageDiscriminator['sendMessageEventToDapp'],
    { messageEvent: MessageLifeCycleEvent; interactionId: string }
  >

  [messageDiscriminator.convertPopupToTab]: MessageBuilder<
    MessageDiscriminator['convertPopupToTab'],
    { data: Messages['walletToLedger'] }
  >

  [messageDiscriminator.getConnectionPassword]: MessageBuilder<
    MessageDiscriminator['getConnectionPassword'],
    {}
  >
  [messageDiscriminator.setConnectionPassword]: MessageBuilder<
    MessageDiscriminator['setConnectionPassword'],
    { connectionPassword?: string }
  >
  [messageDiscriminator.sendMessageToTab]: MessageBuilder<
    MessageDiscriminator['sendMessageToTab'],
    { data: Message; tabId: number }
  >
  [messageDiscriminator.detectWalletLink]: MessageBuilder<
    MessageDiscriminator['detectWalletLink'],
    {}
  >
  [messageDiscriminator.toContentScript]: MessageBuilder<
    MessageDiscriminator['toContentScript'],
    { data: Record<string, any> }
  >
  [messageDiscriminator.walletResponse]: MessageBuilder<
    MessageDiscriminator['walletResponse'],
    { data: Record<string, any> }
  >
  [messageDiscriminator.closeLedgerTab]: MessageBuilder<
    MessageDiscriminator['closeLedgerTab'],
    {}
  >
  [messageDiscriminator.closeDappTab]: MessageBuilder<
    MessageDiscriminator['closeDappTab'],
    { tabId: number }
  >
  [messageDiscriminator.incomingDappMessage]: MessageBuilder<
    MessageDiscriminator['incomingDappMessage'],
    { data: Record<string, any> }
  >
  [messageDiscriminator.dAppRequest]: MessageBuilder<
    MessageDiscriminator['dAppRequest'],
    { data: Record<string, any> }
  >
  [messageDiscriminator.walletMessage]: MessageBuilder<
    MessageDiscriminator['walletMessage'],
    { data: Record<string, any> }
  >
  [messageDiscriminator.incomingWalletMessage]: MessageBuilder<
    MessageDiscriminator['incomingWalletMessage'],
    { data: Record<string, any> }
  >
  [messageDiscriminator.ledgerResponse]: MessageBuilder<
    MessageDiscriminator['ledgerResponse'],
    { data: LedgerResponse }
  >
  [messageDiscriminator.walletToLedger]: MessageBuilder<
    MessageDiscriminator['walletToLedger'],
    { data: LedgerRequest }
  >
}

export type Message = Messages[keyof Messages]

export type MessageHandlerOutput = ReturnType<MessageHandler>

export type MessageHandler = (
  message: Message,
  sendMessageWithConfirmation: SendMessageWithConfirmation,
  tabId?: number
) => ResultAsync<
  { sendConfirmation: boolean; data?: any },
  ConfirmationMessageError['error']
>
