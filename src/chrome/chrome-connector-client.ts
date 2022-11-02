import { Connector, ConnectorType } from 'connector/connector'
import { LogLevelDesc } from 'loglevel'
import { map, Subscription } from 'rxjs'
import { chromeDAppClient } from './chrome-dapp-client'

export const ChromeConnectorClient = (logLevel: LogLevelDesc) => {
  let connector: ConnectorType | undefined
  let subscriptions: Subscription | undefined

  const createConnector = () => {
    connector = Connector({ logLevel })
    subscriptions = connector.message$
      .pipe(map((result) => result.map(chromeDAppClient.sendMessage)))
      .subscribe()
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
