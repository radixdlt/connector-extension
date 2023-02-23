import { ConnectionPassword } from './components/connection-password'
import { ConnectionStatus } from './components/connection-status'
import { PopupWindow } from 'components'
import { useEffect, useState } from 'react'
import { chromeLocalStore } from 'chrome/helpers/chrome-local-store'
import { ConnectorClient } from 'connector/connector-client'
import { config } from 'config'
import { Logger } from 'tslog'
import { ok } from 'neverthrow'

export const Paring = () => {
  const [pairingState, setPairingState] = useState<
    'loading' | 'notPaired' | 'paired'
  >('loading')
  const [connectionPassword, setConnectionPassword] = useState<
    string | undefined
  >()

  useEffect(() => {
    const connectorClient = ConnectorClient({
      source: 'extension',
      target: 'wallet',
      signalingServerBaseUrl: config.signalingServer.baseUrl,
      isInitiator: config.webRTC.isInitiator,
      logger: new Logger({
        prettyLogTemplate: '{{hh}}:{{MM}}:{{ss}}:{{ms}}\t{{logLevelName}}\t',
        minLevel: config.logLevel,
      }),
    })

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes['connectionPassword']) {
        const { newValue } = changes['connectionPassword']
        if (!newValue) connect()
      }
    })

    const subscription = connectorClient.connectionPassword$.subscribe(
      (password) => {
        setConnectionPassword(password.toString('hex'))
      }
    )

    const connect = () =>
      chromeLocalStore
        .getItem('connectionPassword')
        .andThen(({ connectionPassword }) => {
          if (connectionPassword) {
            connectorClient.setConnectionPassword(connectionPassword)
            return ok(null)
          } else {
            connectorClient.connect()
            setPairingState('notPaired')
            return connectorClient
              .generateConnectionPassword()
              .andThen((buffer) =>
                connectorClient.connected().andThen(() => {
                  connectorClient.disconnect()
                  return chromeLocalStore.setItem({
                    connectionPassword: buffer.toString('hex'),
                  })
                })
              )
          }
        })
        .map(() => {
          setPairingState('paired')
        })

    connect()

    return () => {
      connectorClient.destroy()
      subscription.unsubscribe()
    }
  }, [setPairingState, setConnectionPassword])

  return (
    <PopupWindow>
      {pairingState === 'notPaired' && (
        <ConnectionPassword connectionPassword={connectionPassword} />
      )}
      {pairingState === 'paired' && (
        <ConnectionStatus
          onForgetWallet={() => {
            chromeLocalStore.removeItem('connectionPassword')
          }}
        />
      )}
    </PopupWindow>
  )
}
