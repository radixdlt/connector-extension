import { MessageLifeCycleEvent } from 'chrome/dapp/_types'
import {
  AccountListMessage,
  LedgerRequest,
  LedgerResponse,
  LinkClientInteraction,
} from 'ledger/schemas'
import { ResultAsync } from 'neverthrow'
import { ILogObjMeta } from 'tslog/dist/types/interfaces'
import { ILogObj } from 'tslog'
import { Connections } from 'pairing/state/connections'
import { Metadata, WalletInteraction } from '@radixdlt/radix-dapp-toolkit'
import { ConnectorExtensionOptions } from 'options'

export const messageDiscriminator = {
  getConnections: 'getConnections',
  setConnections: 'setConnections',
  setRadixConnectConfiguration: 'setRadixConnectConfiguration',
  getExtensionOptions: 'getExtensionOptions',
  getSessionRouterData: 'getSessionRouterData',
  setSessionRouterData: 'setSessionRouterData',
  dAppRequest: 'dAppRequest',
  walletInteraction: 'walletInteraction',
  cancelWalletInteraction: 'cancelWalletInteraction',
  closeLedgerTab: 'closeLedgerTab',
  focusLedgerTab: 'focusLedgerTab',
  extensionStatus: 'extensionStatus',
  ledgerResponse: 'ledgerResponse',
  walletToLedger: 'walletToLedger',
  walletToExtension: 'walletToExtension',
  walletResponse: 'walletResponse',
  toContentScript: 'toContentScript',
  openParingPopup: 'openParingPopup',
  walletMessage: 'walletMessage',
  sendMessageToTab: 'sendMessageToTab',
  detectWalletLink: 'detectWalletLink',
  confirmation: 'confirmation',
  log: 'log',
  downloadLogs: 'downloadLogs',
  incomingDappMessage: 'incomingDappMessage',
  incomingWalletMessage: 'incomingWalletMessage',
  sendMessageEventToDapp: 'sendMessageEventToDapp',
  restartConnector: 'restartConnector',
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
  popup: 'popup',
} as const

export type MessageSource = keyof typeof messageSource

export type MessageBuilder<
  D extends keyof typeof messageDiscriminator,
  Content,
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
  tabId?: number,
) => ResultAsync<
  ConfirmationMessageSuccess<T>['data'],
  ConfirmationMessageError['error']
>

export type Messages = {
  [messageDiscriminator.openParingPopup]: MessageBuilder<
    MessageDiscriminator['openParingPopup'],
    {}
  >
  [messageDiscriminator.walletInteraction]: MessageBuilder<
    MessageDiscriminator['walletInteraction'],
    {
      interaction: {
        interaction: WalletInteraction
        sessionId?: string
        interactionId: string
      }
    }
  >

  [messageDiscriminator.cancelWalletInteraction]: MessageBuilder<
    MessageDiscriminator['cancelWalletInteraction'],
    {
      interaction: {
        interactionId: string
        metadata: Metadata
      }
    }
  >

  [messageDiscriminator.getSessionRouterData]: MessageBuilder<
    MessageDiscriminator['getSessionRouterData'],
    {}
  >

  [messageDiscriminator.extensionStatus]: MessageBuilder<
    MessageDiscriminator['extensionStatus'],
    {
      eventType: MessageDiscriminator['extensionStatus']
      isWalletLinked: boolean
      isExtensionAvailable: true
    }
  >
  [messageDiscriminator.confirmation]:
    | ConfirmationMessageSuccess
    | ConfirmationMessageError

  [messageDiscriminator.sendMessageEventToDapp]: MessageBuilder<
    MessageDiscriminator['sendMessageEventToDapp'],
    {
      messageEvent: MessageLifeCycleEvent
      data: { interactionId: string; metadata: { origin: string } }
    }
  >
  [messageDiscriminator.log]: MessageBuilder<
    MessageDiscriminator['log'],
    { log: ILogObjMeta & ILogObj }
  >
  [messageDiscriminator.setRadixConnectConfiguration]: MessageBuilder<
    MessageDiscriminator['setRadixConnectConfiguration'],
    {
      connectorExtensionOptions: ConnectorExtensionOptions
    }
  >
  [messageDiscriminator.setSessionRouterData]: MessageBuilder<
    MessageDiscriminator['setSessionRouterData'],
    { data: Record<string, string> }
  >
  [messageDiscriminator.downloadLogs]: MessageBuilder<
    MessageDiscriminator['downloadLogs'],
    {}
  >
  [messageDiscriminator.getExtensionOptions]: MessageBuilder<
    MessageDiscriminator['getExtensionOptions'],
    {}
  >
  [messageDiscriminator.setConnections]: MessageBuilder<
    MessageDiscriminator['setConnections'],
    { connections: Connections }
  >
  [messageDiscriminator.getConnections]: MessageBuilder<
    MessageDiscriminator['getConnections'],
    {}
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
  [messageDiscriminator.focusLedgerTab]: MessageBuilder<
    MessageDiscriminator['focusLedgerTab'],
    {}
  >
  [messageDiscriminator.incomingDappMessage]: MessageBuilder<
    MessageDiscriminator['incomingDappMessage'],
    { data: Record<string, any> }
  >
  [messageDiscriminator.dAppRequest]: MessageBuilder<
    MessageDiscriminator['dAppRequest'],
    { data: WalletInteraction }
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
    { data: LedgerResponse; walletPublicKey: string }
  >
  [messageDiscriminator.walletToExtension]: MessageBuilder<
    MessageDiscriminator['walletToExtension'],
    {
      data: AccountListMessage | LinkClientInteraction
      walletPublicKey: string
    }
  >
  [messageDiscriminator.walletToLedger]: MessageBuilder<
    MessageDiscriminator['walletToLedger'],
    { data: LedgerRequest; walletPublicKey: string }
  >
  [messageDiscriminator.restartConnector]: MessageBuilder<
    MessageDiscriminator['restartConnector'],
    {}
  >
}

export type Message = Messages[keyof Messages]

export type MessageHandlerOutput = ReturnType<MessageHandler>

export type MessageHandler = (
  message: Message,
  sendMessageWithConfirmation: SendMessageWithConfirmation,
  tabId?: number,
) => ResultAsync<
  { sendConfirmation: boolean; data?: any },
  ConfirmationMessageError['error']
>
