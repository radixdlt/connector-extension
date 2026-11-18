import type { MessageLifeCycleEvent } from 'chrome/dapp/_types'
import type {
  LedgerRequest,
  LedgerResponse,
  WalletToExtensionMessage,
} from 'ledger/schemas'
import type { ResultAsync } from 'neverthrow'
import { errAsync } from 'neverthrow'
import type { ILogObjMeta } from 'tslog/dist/types/interfaces'
import type { ILogObj } from 'tslog'
import type { Connections } from 'pairing/state/connections'
import type { Metadata, WalletInteraction } from '@radixdlt/radix-dapp-toolkit'
import type { ConnectorExtensionOptions } from 'options'
import type {
  PendingRequest,
  PendingRequestsResponse,
  RequestStatus,
  RequestOutcomes,
} from 'chrome/offscreen/requests/pending-request'
import type { ConnectionDiagnosticsResponse } from 'chrome/offscreen/wallet-connection/transport/diagnostics'
import type { RequestNotification } from 'chrome/offscreen/requests/request-tracker'
import type { LinkStatuses } from 'chrome/offscreen/link-statuses'
import type { RetiredLink } from 'chrome/links/retired-links'

/**
 * A wallet's answer as the offscreen document passes it on: to the dApp's tab, in
 * `walletResponse`; to the background, the answer itself. Both with its metadata.
 */
export type WalletResponseData = Record<string, unknown> & {
  walletResponse?: Record<string, unknown>
  metadata?: {
    origin?: string
    tabId?: number
    networkId?: number
    sessionId?: string
    walletPublicKey?: string
  }
}

/**
 * Every message between the extension's parts, by discriminator: what it carries
 * besides `source`, `discriminator` and `messageId`. A new message starts here;
 * `createMessage` then builds it.
 */
export type MessagePayloads = {
  getConnections: {}
  setConnections: { connections: Connections }
  setRadixConnectConfiguration: {
    connectorExtensionOptions: ConnectorExtensionOptions
  }
  getExtensionOptions: {}
  getSessionRouterData: {}
  setSessionRouterData: { data: Record<string, string> }
  dAppRequest: { data: WalletInteraction }
  walletInteraction: {
    interaction: {
      interaction: WalletInteraction
      sessionId?: string
      interactionId: string
    }
  }
  cancelWalletInteraction: {
    interaction: {
      interactionId: string
      metadata: Metadata
    }
  }
  closeLedgerTab: {}
  focusLedgerTab: {}
  ledgerResponse: { data: LedgerResponse; walletPublicKey: string }
  walletToLedger: { data: LedgerRequest; walletPublicKey: string }
  walletToExtension: {
    data: WalletToExtensionMessage
    walletPublicKey: string
  }
  walletResponse: { data: WalletResponseData }
  sendMessageToTab: { data: Message; tabId: number }
  confirmation:
    | { success: true; data: unknown }
    | {
        success: false
        error: { reason: string; message?: string; jsError?: Error }
      }
  log: { log: ILogObjMeta & ILogObj }
  downloadLogs: {}
  sendMessageEventToDapp: {
    messageEvent: MessageLifeCycleEvent
    data: { interactionId: string; metadata: { origin: string } }
  }
  restartConnector: {}
  getConnectionDiagnostics: {}
  getPendingRequests: {}
  pendingRequestsChanged: {
    requests: PendingRequest[]
    outcomes?: RequestOutcomes
  }
  cancelPendingRequest: { interactionId: string }
  resendPendingRequest: { interactionId: string }
  dAppRequestNotification: { notification: RequestNotification }
  getLinkStatuses: {}
  linkStatusesChanged: { statuses: LinkStatuses }
  /** The offscreen document asks for the notices to deliver (see `chrome/links`). */
  getRetiredLinks: {}
  setRetiredLinks: { links: RetiredLink[] }
  /** A notice reached its wallet: its password can be forgotten. */
  linkRemovalDelivered: { password: string }
  /** The link's wallet was seen on this iroh relay: kept with the link. */
  walletRelaySeen: { walletPublicKey: string; relayUrl: string }
}

/**
 * The data of the confirmation that answers a request, for the messages whose
 * answer carries data; the others are answered with none.
 */
export type MessageAnswers = {
  getConnections: Connections
  getExtensionOptions: { options: ConnectorExtensionOptions }
  getSessionRouterData: Record<string, string>
  getConnectionDiagnostics: ConnectionDiagnosticsResponse
  getPendingRequests: PendingRequestsResponse
  cancelPendingRequest: { cancelled: boolean; status?: RequestStatus }
  resendPendingRequest: { resent: boolean }
  getLinkStatuses: { statuses: LinkStatuses }
  getRetiredLinks: RetiredLink[]
}

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
  D extends keyof MessagePayloads,
  Content = MessagePayloads[D],
> = {
  source: MessageSource
  discriminator: D
  messageId: string
} & Content

export type ConfirmationMessageSuccess<T = any> = MessageBuilder<
  'confirmation',
  { success: true; data: T }
>
export type ConfirmationMessageError = MessageBuilder<
  'confirmation',
  Extract<MessagePayloads['confirmation'], { success: false }>
>

/** The data of the confirmation that answers `M`. */
export type AnswerOf<M extends Message> =
  M['discriminator'] extends keyof MessageAnswers
    ? MessageAnswers[M['discriminator']]
    : undefined

export type SendMessageWithConfirmation = <M extends Message>(
  message: M,
  tabId?: number,
) => ResultAsync<AnswerOf<M>, ConfirmationMessageError['error']>

export type Messages = {
  [D in Exclude<keyof MessagePayloads, 'confirmation'>]: MessageBuilder<D>
} & {
  confirmation: ConfirmationMessageSuccess | ConfirmationMessageError
}

export type Message = Messages[keyof Messages]

export type MessageHandlerOutput = ReturnType<MessageHandler>

export type MessageHandler = (
  message: Message,
  sendMessageWithConfirmation: SendMessageWithConfirmation,
  tabId?: number,
) => ResultAsync<
  { sendConfirmation: boolean; data?: unknown },
  ConfirmationMessageError['error']
>

/** A handler's answer to `message`: its data must be the one `MessageAnswers` gives. */
export const answer = <M extends Message>(_message: M, data: AnswerOf<M>) => ({
  sendConfirmation: true,
  data,
})

/** One handler per message it handles, each given its message with its type. */
export type MessageHandlers = {
  [D in keyof Messages]?: (
    message: Messages[D],
    sendMessageWithConfirmation: SendMessageWithConfirmation,
    tabId?: number,
  ) => MessageHandlerOutput
}

type AnyMessageHandler = (
  message: Message,
  sendMessageWithConfirmation: SendMessageWithConfirmation,
  tabId?: number,
) => MessageHandlerOutput

/**
 * The `MessageHandler` of `handlers`. Any other message fails with
 * `unhandledMessageDiscriminator`, which `MessageClient` does not answer: another
 * part of the extension handles it.
 */
export const handleMessages =
  (handlers: MessageHandlers): MessageHandler =>
  (message, sendMessageWithConfirmation, tabId) => {
    const discriminator = message?.discriminator
    const handler =
      discriminator && Object.hasOwn(handlers, discriminator)
        ? (handlers[discriminator] as AnyMessageHandler)
        : undefined
    return handler
      ? handler(message, sendMessageWithConfirmation, tabId)
      : errAsync({ reason: 'unhandledMessageDiscriminator' })
  }
