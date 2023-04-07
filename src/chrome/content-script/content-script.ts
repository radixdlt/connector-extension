import {
  ChromeDAppClient,
  MessageLifeCycleEvent,
} from '../helpers/chrome-dapp-client'
import { ContentScriptMessageHandler } from './message-handler'
import { createMessage } from '../messages/create-message'
import { MessageClient } from '../messages/message-client'
import { ConfirmationMessageError, Message } from '../messages/_types'
import { errAsync, okAsync, ResultAsync } from 'neverthrow'
import { logger } from 'utils/logger'

const chromeDAppClient = ChromeDAppClient()

const sendMessageToDapp = (
  message: Record<string, any>
): ResultAsync<undefined, ConfirmationMessageError['error']> => {
  logger.debug('content-script: sendMessageToDapp', { message })
  const result = chromeDAppClient.sendMessage(message)

  return result.isErr()
    ? errAsync({ reason: 'unableToSendMessageToDapp' })
    : okAsync(undefined)
}

const sendMessageEventToDapp = (
  interactionId: string,
  eventType: MessageLifeCycleEvent
): ResultAsync<undefined, ConfirmationMessageError['error']> => {
  const result = chromeDAppClient.sendMessageEvent(interactionId, eventType)
  return result.isErr()
    ? errAsync({ reason: 'unableToSendMessageEventToDapp' })
    : okAsync(undefined)
}

const messageHandler = MessageClient(
  ContentScriptMessageHandler({
    sendMessageToDapp,
    sendMessageEventToDapp,
    logger: logger,
  }),
  'contentScript',
  {}
)

chromeDAppClient.messageListener((message) => {
  messageHandler.onMessage(createMessage.incomingDappMessage('dApp', message))
})

chrome.runtime.onMessage.addListener((message: Message) => {
  logger.debug('content-script: received message', message)
  messageHandler.onMessage(message)
})
