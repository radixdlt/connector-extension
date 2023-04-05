import { ResultAsync } from 'neverthrow'
import { ChromeDAppClient, messageLifeCycleEvent } from './chrome-dapp-client'
import { decorateMessage } from './helpers/decorate-message'
import { sendMessage } from './helpers/send-message'
import { ContentScriptMessageHandler } from './messages/content-script-messages'
import { createMessage } from './messages/create-message'
import { MessageHandler } from './messages/message-handler'
import { ContentScriptMessage } from './messages/_types'

const chromeDAppClient = ChromeDAppClient()

chromeDAppClient.messageListener((message) => {
  chromeDAppClient
    .sendMessageEvent(
      message.interactionId,
      messageLifeCycleEvent.receivedByExtension
    )
    .andThen(() => decorateMessage(message))
    .asyncAndThen((message) =>
      ResultAsync.combine([
        sendMessage(createMessage.dAppRequest(message)),
        sendMessage(createMessage.detectWalletLink()),
      ])
    )
})

const messageHandler = MessageHandler({
  contentScriptMessageHandler: ContentScriptMessageHandler(chromeDAppClient),
})

chrome.runtime.onMessage.addListener((message: ContentScriptMessage) => {
  messageHandler.onMessage(message)
})

sendMessage(createMessage.getConnectionPassword())
