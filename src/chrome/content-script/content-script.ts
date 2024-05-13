import { ChromeDAppClient } from '../dapp/dapp-client'
import { ContentScriptMessageHandler } from './message-handler'
import { createMessage } from '../messages/create-message'
import { MessageClient } from '../messages/message-client'
import { ConfirmationMessageError, Message } from '../messages/_types'
import { errAsync, okAsync, ResultAsync } from 'neverthrow'
import { logger } from 'utils/logger'
import { MessageLifeCycleEvent } from 'chrome/dapp/_types'
import { sendMessage } from 'chrome/helpers/send-message'
import { hasConnections } from 'chrome/helpers/get-connections'
import {
  ExtensionInteraction,
  WalletInteraction,
} from '@radixdlt/radix-dapp-toolkit'
import { addOriginToWalletInteraction } from 'chrome/helpers/add-origin-to-wallet-interaction'

const appLogger = logger.getSubLogger({ name: 'content-script' })

const chromeDAppClient = ChromeDAppClient(appLogger)

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

const handleWalletInteraction = async (
  walletInteraction: WalletInteraction,
) => {
  sendMessage(createMessage.dAppRequest('contentScript', walletInteraction))
}

const handleExtensionInteraction = async (
  extensionInteraction: ExtensionInteraction,
) => {
  switch (extensionInteraction.discriminator) {
    case 'openPopup':
      await sendMessage(createMessage.openParingPopup())
      break

    case 'extensionStatus':
      await hasConnections().map((hasConnections) => {
        sendMessageToDapp(createMessage.extensionStatus(hasConnections))
      })
      break

    case 'cancelWalletInteraction':
      sendMessage(
        createMessage.cancelWalletInteraction(
          addOriginToWalletInteraction(extensionInteraction),
        ),
      )
      break

    case 'walletInteraction':
      sendMessage(
        createMessage.walletInteraction({
          ...extensionInteraction,
          interaction: addOriginToWalletInteraction(
            extensionInteraction.interaction,
          ),
        }),
      )
      break

    default:
      logger.error({
        reason: 'InvalidExtensionRequest',
        interaction: extensionInteraction,
      })
      break
  }
}

// incoming messages from dApps
chromeDAppClient.messageListener(
  handleWalletInteraction,
  handleExtensionInteraction,
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
