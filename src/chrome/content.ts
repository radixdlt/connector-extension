import { ChromeConnectorClient } from './chrome-connector-client'
import { chromeDAppClient } from './chrome-dapp-client'
import { decorateMessage } from './helpers/decorate-message'

const connectorClient = ChromeConnectorClient('debug')

chromeDAppClient.messageListener((message) => {
  decorateMessage(message)
    .map(connectorClient.getConnector().sendMessage)
    .map(chrome.runtime.sendMessage)
})
