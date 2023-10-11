import { radixConnectConfig } from 'config'
import { ConnectorClient } from '@radixdlt/radix-connect-webrtc'
import { useState, useEffect } from 'react'
import { logger } from 'utils/logger'
import { Box, Button, Header, Text } from 'components'
import {
  getDerivePublicKeyPayload,
  getDeviceInfoPayload,
  getSignEd222519ChallengePayload,
  getSignSecp256k1ChallengePayload,
  getSignEd25519TransactionPayload,
  getSignSecp256k1TransactionPayload,
  getDeriveAndDisplayPayload,
} from '../example'
import { getConnectionPassword } from 'chrome/helpers/get-connection-password'
import { getExtensionOptions } from 'options'

export const WalletSimulator = () => {
  const [connector, setConnector] =
    useState<ReturnType<typeof ConnectorClient>>()
  const [connectorStatus, setConnectorStatus] = useState<boolean>(false)
  const [message, setMessage] = useState<string>('')
  const [responseMessage, setResponseMessage] = useState<string>('---')
  const [error, setError] = useState<string>('')

  const messages = {
    'Get UDI': getDeviceInfoPayload(),
    'Get Public Key': getDerivePublicKeyPayload(),
    'Derive & Display (Curve25519)': getDeriveAndDisplayPayload(),
    'Sign TX (Secp256k1)': getSignSecp256k1TransactionPayload(),
    'Sign TX (Curve25519)': getSignEd25519TransactionPayload(),
    'Sign Auth (Curve25519)': getSignEd222519ChallengePayload(),
    'Sign Auth (Secp256k1)': getSignSecp256k1ChallengePayload(),
  }

  useEffect(() => {
    let connectorClient = ConnectorClient({
      source: 'wallet',
      target: 'extension',
      isInitiator: false,
      logger: logger.getSubLogger({ name: 'devTools' }),
    })

    getExtensionOptions().map((options) => {
      connectorClient.setConnectionConfig(
        radixConnectConfig[options.radixConnectConfiguration],
      )
    })

    chrome.storage.onChanged.addListener((changes) => {
      if (changes['options']) {
        if (
          changes['options'].newValue.radixConnectConfiguration !==
          changes['options'].oldValue.radixConnectConfiguration
        ) {
          connectorClient.setConnectionConfig(
            radixConnectConfig[
              changes['options'].newValue.radixConnectConfiguration
            ],
          )
        }
      }
      if (changes['connectionPassword']) {
        const { newValue } = changes['connectionPassword']
        connector?.setConnectionPassword(Buffer.from(newValue, 'hex'))
      }
    })

    getConnectionPassword().map((connectionPassword) => {
      if (connectionPassword) {
        connectorClient.setConnectionPassword(
          Buffer.from(connectionPassword, 'hex'),
        )
      }
    })

    const subscription =
      connectorClient.connected$.subscribe(setConnectorStatus)

    connectorClient.onMessage$.subscribe((msg) =>
      setResponseMessage(JSON.stringify(msg, null, 2)),
    )

    setConnector(connectorClient)
    return () => {
      connectorClient.destroy()
      subscription.unsubscribe()
    }
  }, [setConnector, setResponseMessage, setConnectorStatus])

  const sendMessage = () => {
    try {
      connector?.sendMessage(JSON.parse(message || '{}'))
    } catch (e) {
      setError(String(e))
    }
  }

  const toggleConnection = () => {
    if (connectorStatus) {
      connector?.disconnect()
    } else {
      connector?.connect()
    }
  }

  return (
    <Box p="medium" bg="white" rounded mr="lg">
      <Header dark>Wallet Simulator</Header>
      <Box justify="between">
        <Box flex="row">
          <Text bold>Connector</Text>
          <Text ml="md">{connectorStatus ? '🟢' : '🔴'}</Text>
        </Box>
        <Button onClick={toggleConnection}>
          {connectorStatus ? 'Disconnect' : 'Connect'}
        </Button>
      </Box>
      <Box justify="between">
        <Text css={{ minWidth: '140px' }} bold>
          Mock Requests
        </Text>
        <Box>
          {Object.entries(messages).map(([button, value]) => (
            <Button
              ml="sm"
              mb="sm"
              size="small"
              key={button}
              onClick={() => setMessage(JSON.stringify(value, null, 2))}
            >
              {button}
            </Button>
          ))}
        </Box>
      </Box>
      <Box justify="between">
        <textarea
          name="message"
          cols={70}
          rows={12}
          value={message}
          onInput={(ev) => {
            // @ts-ignore
            setMessage(ev.target.value || '')
          }}
        />

        <Button onClick={sendMessage}>Send</Button>
      </Box>

      <br />
      <Text bold>Recent Extension Message</Text>
      <pre style={{ maxWidth: '500px', overflowX: 'auto' }}>
        {responseMessage}
      </pre>
      <Text>{error}</Text>
    </Box>
  )
}
