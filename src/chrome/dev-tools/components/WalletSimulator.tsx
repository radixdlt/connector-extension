import { config } from 'config'
import { chromeLocalStore } from 'chrome/helpers/chrome-local-store'
import { ConnectorClient } from 'connector/connector-client'
import { ok } from 'neverthrow'
import { useState, useEffect } from 'react'
import { logger } from 'utils/logger'
import { Box, Button, Header, Text } from 'components'
import {
  getDerivePublicKeyPayload,
  getDeviceInfoPayload,
  getSignTransactionPayload,
  getSignChallengePayload,
  getImportFromOlympiaPayload,
} from '../example'
export const WalletSimulator = () => {
  const [connector, setConnector] =
    useState<ReturnType<typeof ConnectorClient>>()
  const [connectorStatus, setConnectorStatus] = useState<boolean>(false)
  const [message, setMessage] = useState<string>('')
  const [responseMessage, setResponseMessage] = useState<string>('---')
  const [error, setError] = useState<string>('')

  const messages = {
    'Import from Olympia': getImportFromOlympiaPayload(),
    'Get UDI from Ledger': getDeviceInfoPayload(),
    'Get Public Key from Ledger': getDerivePublicKeyPayload(),
    'Sign Transaction on Ledger': getSignTransactionPayload(),
    'Sign Challenge on Ledger': getSignChallengePayload(),
  }

  useEffect(() => {
    let connectorClient = ConnectorClient({
      source: 'wallet',
      target: 'extension',
      signalingServerBaseUrl: config.signalingServer.baseUrl,
      isInitiator: false,
      logger,
    })

    chromeLocalStore
      .getItem('connectionPassword')
      .andThen(({ connectionPassword }) => {
        if (connectionPassword) {
          connectorClient.setConnectionPassword(
            Buffer.from(connectionPassword, 'hex')
          )
        }

        return ok(undefined)
      })

    const subscription =
      connectorClient.connected$.subscribe(setConnectorStatus)

    connectorClient.onMessage$.subscribe((msg) =>
      setResponseMessage(JSON.stringify(msg, null, 2))
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
    <Box p="medium">
      <Header dark>Wallet Simulator</Header>
      <Box justify="between">
        <Box flex="row">
          <Text bold>Connector</Text>
          <Text ml="medium">{connectorStatus ? '🟢' : '🔴'}</Text>
        </Box>
        <Button onClick={toggleConnection}>
          {connectorStatus ? 'Disconnect' : 'Connect'}
        </Button>
      </Box>
      <Box justify="between">
        <Text css={{ minWidth: '140px' }} bold>
          Mock Requests
        </Text>
        <Box flex="row">
          {Object.entries(messages).map(([button, value]) => (
            <Button
              ml="small"
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
      <pre>{responseMessage}</pre>
      <Text>{error}</Text>
    </Box>
  )
}
