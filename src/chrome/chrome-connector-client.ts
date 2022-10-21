import { Connector, ConnectorType } from 'connector/connector'
import { dAppClient } from 'dapp/dapp-client'
import { Subscription } from 'rxjs'

export const ChromeConnectorClient = () => {
  let connector: ConnectorType | undefined
  let subscriptions: Subscription | undefined

  const createConnector = () => {
    connector = Connector({ logLevel: 'debug' })
    subscriptions = connector.message$.subscribe(dAppClient.chrome.sendMessage)
  }

  const destroy = () => {
    subscriptions?.unsubscribe()
    subscriptions = undefined
    connector?.destroy()
    connector = undefined
  }

  const getConnector = () => {
    if (!connector) createConnector()
    return connector!
  }

  return { getConnector, destroy }
}
