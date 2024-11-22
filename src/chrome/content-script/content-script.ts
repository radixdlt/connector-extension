import { ChromeDAppClient } from '../dapp/dapp-client'
import { ContentScriptMessageHandler } from './message-handler'
import { createMessage } from '../messages/create-message'
import { MessageClient } from '../messages/message-client'
import { ConfirmationMessageError, Message } from '../messages/_types'
import { err, errAsync, okAsync, ResultAsync } from 'neverthrow'
import { logger } from 'utils/logger'
import { dAppEvent, MessageLifeCycleEvent } from 'chrome/dapp/_types'
import { sendMessage } from 'chrome/helpers/send-message'
import { hasConnections } from 'chrome/helpers/get-connections'
import {
  ExtensionInteraction,
  WalletInteraction,
} from '@radixdlt/radix-dapp-toolkit'
import {
  addOriginToCancelInteraction,
  addOriginToWalletInteraction,
} from 'chrome/helpers/add-origin-to-wallet-interaction'
import { handleInboundMessage } from './handleInboundMessage'
import { handleOutboundMessage } from './handleOutboundMessage'

const appLogger = logger.getSubLogger({ name: 'content-script' })

const chromeDAppClient = ChromeDAppClient(appLogger)

window.addEventListener(dAppEvent.send, handleInboundMessage)
chrome.runtime.onMessage.addListener(handleOutboundMessage)

const sendMessageToDapp = (
  message: Record<string, any>,
): ResultAsync<undefined, ConfirmationMessageError['error']> => {
  const result = chromeDAppClient.sendMessage(message)

  return result.isErr()
    ? errAsync({ reason: 'unableToSendMessageToDapp' })
    : okAsync(undefined)
}

const sendMessageEventToDapp = (
  data: { interactionId: string; metadata: { origin: string } },
  eventType: MessageLifeCycleEvent,
): ResultAsync<undefined, ConfirmationMessageError['error']> => {
  if (window.location.origin !== data.metadata.origin) return okAsync(undefined)

  const result = chromeDAppClient.sendMessageEvent(
    data.interactionId,
    eventType,
  )
  return result.isErr()
    ? errAsync({ reason: 'unableToSendMessageEventToDapp' })
    : okAsync(undefined)
}

const messageHandler = MessageClient(
  ContentScriptMessageHandler({
    sendMessageToDapp,
    sendMessageEventToDapp,
    logger,
  }),
  'contentScript',
  { logger: appLogger },
)

const handleWalletInteraction = (walletInteraction: WalletInteraction) =>
  sendMessage(createMessage.dAppRequest('contentScript', walletInteraction))

const handleExtensionInteraction = (
  extensionInteraction: ExtensionInteraction,
) => {
  switch (extensionInteraction.discriminator) {
    // handled by background router
    case 'openPopup':
    case 'extensionStatus':
      return okAsync(undefined)

    case 'cancelWalletInteraction':
      return sendMessage(
        createMessage.cancelWalletInteraction(
          addOriginToCancelInteraction(extensionInteraction),
        ),
      )

    case 'walletInteraction':
      return sendMessage(
        createMessage.walletInteraction({
          ...extensionInteraction,
          interaction: addOriginToWalletInteraction(
            extensionInteraction.interaction,
          ),
        }),
      )

    default:
      return err({
        reason: 'InvalidExtensionRequest',
        interaction: extensionInteraction,
      })
  }
}

// incoming messages from dApps
chromeDAppClient.messageListener(
  (p) =>
    handleWalletInteraction(p).mapErr((e) => {
      appLogger.error('handleWalletInteraction', e)
    }),
  (p) =>
    handleExtensionInteraction(p).mapErr((e) => {
      appLogger.error('handleExtensionInteraction', e)
    }),
)

// incoming messages from extension
chrome.runtime.onMessage.addListener((message: Message) => {
  messageHandler.onMessage(message)
})

chrome.storage.onChanged.addListener(
  (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
    if (changes['connections'] && area === 'local') {
      hasConnections().map((hasConnections) => {
        sendMessageToDapp(createMessage.extensionStatus(hasConnections))
      })
    }
  },
)

hasConnections().map((hasConnections) => {
  sendMessageToDapp(createMessage.extensionStatus(hasConnections))
})
