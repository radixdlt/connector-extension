import { offscreenReadyMessage } from './helpers'
import { config } from 'config'
import { ConnectorClient } from 'connector/connector-client'
import { logger } from 'utils/logger'

const connectorClient = ConnectorClient({
  source: 'extension',
  target: 'wallet',
  signalingServerBaseUrl: config.signalingServer.baseUrl,
  isInitiator: true,
  logger,
})

connectorClient.onMessage$.subscribe(chrome.runtime.sendMessage)

chrome.runtime.onMessage.addListener((message) => {
  if ('connectionPassword' in message) {
    if (message.connectionPassword) {
      connectorClient.setConnectionPassword(
        Buffer.from(message.connectionPassword, 'hex')
      )
      connectorClient.connect()
    } else {
      connectorClient.disconnect()
    }
  }
})

chrome.runtime.sendMessage(offscreenReadyMessage)
