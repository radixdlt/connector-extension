import { ConnectionPassword } from './components/connection-password'
import { ConnectionStatus } from './components/connection-status'
import { PopupWindow } from 'components'
import { useEffect, useState } from 'react'
import { chromeLocalStore } from 'chrome/helpers/chrome-local-store'
import { ConnectorClient } from '@radixdlt/radix-connect-webrtc'
import { ok } from 'neverthrow'
import { logger } from 'utils/logger'
import { getExtensionOptions } from 'options'
import { config, radixConnectConfig } from 'config'

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
      isInitiator: config.webRTC.isInitiator,
      logger,
    })

    getExtensionOptions().map((options) => {
      connectorClient.setConnectionConfig(
        radixConnectConfig[options.radixConnectConfiguration],
      )
    })

    chrome.storage.onChanged.addListener((changes, area) => {
      if (changes['options']) {
        if (
          changes['options'].newValue.radixConnectConfiguration !==
          changes['options'].oldValue?.radixConnectConfiguration
        ) {
          connectorClient.setConnectionConfig(
            radixConnectConfig[
              changes['options'].newValue.radixConnectConfiguration
            ],
          )
        }
      }
      if (area === 'local' && changes['connectionPassword']) {
        const { newValue } = changes['connectionPassword']
        if (!newValue) connect()
      }
    })

    const subscription = connectorClient.connectionPassword$.subscribe(
      (password) => {
        setConnectionPassword(password?.toString('hex'))
      },
    )

    const connect = () =>
      chromeLocalStore
        .getItem('connectionPassword')
        .andThen(({ connectionPassword }) => {
          if (connectionPassword) {
            connectorClient.setConnectionPassword(
              Buffer.from(connectionPassword, 'hex'),
            )
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
                }),
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
