import { ChromeDAppClient } from '../dapp/dapp-client'
import { ContentScriptMessageHandler } from './message-handler'
import { createMessage } from '../messages/create-message'
import { MessageClient } from '../messages/message-client'
import { ConfirmationMessageError, Message } from '../messages/_types'
import { errAsync, okAsync, ResultAsync } from 'neverthrow'
import { logger } from 'utils/logger'
import { MessageLifeCycleEvent } from 'chrome/dapp/_types'
import { getConnectionPassword } from 'chrome/helpers/get-connection-password'
import {
  WalletInteractionWithOrigin,
  ExtensionInteraction,
} from '@radixdlt/radix-connect-schemas'
import { sendMessage } from 'chrome/helpers/send-message'

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
  walletInteraction: WalletInteractionWithOrigin,
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
      await getConnectionPassword().map((connectionPassword) => {
        sendMessageToDapp(createMessage.extensionStatus(!!connectionPassword))
      })
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
  (changes: { [key: string]: chrome.storage.StorageChange }) => {
    if (changes['connectionPassword'])
      sendMessageToDapp(
        createMessage.extensionStatus(
          !!changes['connectionPassword']?.newValue,
        ),
      )
  },
)

getConnectionPassword().map((connectionPassword) => {
  sendMessageToDapp(createMessage.extensionStatus(!!connectionPassword))
})
