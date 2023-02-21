import { ConnectorClient } from 'connector/connector-client'
import { config } from 'config'
import {
  distinctUntilChanged,
  first,
  interval,
  map,
  Subscription,
  switchMap,
  tap,
} from 'rxjs'
import { ChromeDAppClient } from './chrome-dapp-client'
import { Logger } from 'tslog'
import { chromeLocalStore } from './helpers/chrome-local-store'

const chromeDAppClient = ChromeDAppClient()

export const ChromeConnectorClient = () => {
  let connector: ConnectorClient | undefined
  const subscriptions = new Subscription()

  const createConnector = () => {
    const logger = new Logger({
      prettyLogTemplate: '{{hh}}:{{MM}}:{{ss}}:{{ms}}\t{{logLevelName}}\t',
      minLevel: 2,
    })
    connector = ConnectorClient({
      source: 'extension',
      target: 'wallet',
      signalingServerBaseUrl: config.signalingServer.baseUrl,
      isInitiator: false,
      logger,
    })

    const hiddenDetection$ = interval(1000).pipe(
      map(() => document.hidden),
      distinctUntilChanged()
    )

    subscriptions.add(
      connector.shouldConnect$
        .pipe(
          first(),
          switchMap(() =>
            hiddenDetection$.pipe(
              tap((isHidden) => {
                if (isHidden) connector?.disconnect()
                else connector?.connect()
              })
            )
          )
        )
        .subscribe()
    )

    subscriptions.add(
      connector.onMessage$
        .pipe(map((message) => chromeDAppClient.sendMessage(message)))
        .subscribe()
    )

    connector.connect()

    chromeLocalStore
      .getItem('connectionPassword')
      .map(({ connectionPassword }) => {
        if (connectionPassword)
          connector?.setConnectionPassword(
            Buffer.from(connectionPassword, 'hex')
          )
      })
  }

  const onChange = ({
    connectionPassword,
  }: {
    [key: string]: chrome.storage.StorageChange
  }) => {
    if (!connectionPassword.newValue) {
      connector?.disconnect()
    } else if (connectionPassword.newValue) {
      connector?.setConnectionPassword(
        Buffer.from(connectionPassword.newValue, 'hex')
      )
      connector?.connect()
    }
  }

  chrome.storage.onChanged.addListener(onChange)

  const destroy = () => {
    subscriptions.unsubscribe()
    connector?.destroy()
    chrome.storage.onChanged.removeListener(onChange)
    connector = undefined
  }

  const getConnector = () => {
    if (!connector) createConnector()
    return connector!
  }

  return { getConnector, destroy }
}
