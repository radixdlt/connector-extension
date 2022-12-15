import { Connector, ConnectorType } from 'connector/connector'
import { StorageClient } from 'connector/storage/storage-client'
import { config } from 'config'
import log, { LogLevelDesc } from 'loglevel'
import { map, Subscription } from 'rxjs'
import { ChromeDAppClient } from './chrome-dapp-client'

const chromeDAppClient = ChromeDAppClient()

export const ChromeConnectorClient = (logLevel: LogLevelDesc) => {
  let connector: ConnectorType | undefined
  let subscriptions: Subscription | undefined
  const logger = log

  chrome.storage.local.get('loglevel').then((value) => {
    const storedLoglevel = value['loglevel']

    if (storedLoglevel === 'DEBUG')
      console.log(`Radix Connector loglevel: 'debug'`)

    logger.setLevel(storedLoglevel || logLevel)
  })

  const createConnector = () => {
    connector = Connector({
      logger,
      storageClient: StorageClient({ id: config.storage.key }),
      generateConnectionPassword: false,
    })
    connector.connect()
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
