import { dAppClient } from 'dapp/dapp-client'
import { ChromeConnectorClient } from './chrome-connector-client'

const connectorClient = ChromeConnectorClient()

dAppClient.chrome.messageListener((message) => {
  connectorClient
    .getConnector()
    .sendMessage(message)
    .map(chrome.runtime.sendMessage)
})
