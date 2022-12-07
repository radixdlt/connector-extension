import { ChromeConnectorClient } from './chrome-connector-client'
import { ChromeDAppClient, messageLifeCycleEvent } from './chrome-dapp-client'
import { decorateMessage } from './helpers/decorate-message'

const connectorClient = ChromeConnectorClient('TRACE')
const chromeDAppClient = ChromeDAppClient()

chromeDAppClient.messageListener((message) => {
  decorateMessage(message)
    .map(connectorClient.getConnector().sendMessage)
    .map(chrome.runtime.sendMessage)
    .andThen(() =>
      chromeDAppClient.sendMessageEvent(
        message.requestId,
        messageLifeCycleEvent.receivedByExtension
      )
    )
})
