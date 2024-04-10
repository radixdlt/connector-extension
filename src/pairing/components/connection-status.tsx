import { Box, Button } from '../../components'
import { PairingHeader } from './pairing-header'
import { useEffect, useState } from 'react'
import { LinkedWallet } from 'components/linked-wallet/linked-wallet'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useConnectionsClient } from 'pairing/state/connections'
import { ForgetThisWallet } from './forget-this-wallet'
import { RenameWalletLink } from './rename-wallet-link'
import { sendMessage } from 'chrome/messages/send-message'
import { createMessage } from 'chrome/messages/create-message'
import { Message } from 'chrome/messages/_types'

export const ConnectionStatus = () => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const connectionsClient = useConnectionsClient()
  const connections = connectionsClient.connections
  const [pendingAccountRequest, setPendingAccountRequest] = useState<
    Record<string, string>
  >({})
  const [connectionIdToForget, setConnectionIdToForget] = useState<string>('')
  const [connectionIdToChangeName, setConnectionIdToChangeName] =
    useState<string>('')

  useEffect(() => {
    if (searchParams.has('newWallet')) {
      sendAccountListRequest(searchParams.get('newWallet') as string)
      setSearchParams({})
    }
  }, [searchParams])

  useEffect(() => {
    if (connectionsClient.isLoading()) return
    if (connectionsClient.hasNoConnections()) {
      navigate('/pairing')
    }
  }, [connections])

  useEffect(() => {
    const handler = (message: Message) => {
      console.log(message)
      if (message.discriminator === 'walletToExtension') {
        const interactionId = message.data.interactionId
        if (pendingAccountRequest[message.walletPublicKey] === interactionId) {
          setPendingAccountRequest({
            ...pendingAccountRequest,
            [message.walletPublicKey]: '',
          })
        }
      }
    }
    chrome.runtime.onMessage.addListener(handler)

    return () => {
      chrome.runtime.onMessage.removeListener(handler)
    }
  }, [pendingAccountRequest])

  const forgetWallet = () => {
    connectionsClient.remove(connectionIdToForget)
    setConnectionIdToForget('')
  }

  const updateWalletName = (walletName: string) => {
    connectionsClient.updateName(walletName, connectionIdToChangeName)
    setConnectionIdToChangeName('')
  }

  const renderForgetWalletConfirmation = () => {
    if (!connectionIdToForget) return null

    return (
      <ForgetThisWallet
        forgetWallet={forgetWallet}
        cancel={() => setConnectionIdToForget('')}
      />
    )
  }

  const renderChangeWalletName = () => {
    if (!connectionIdToChangeName || !connections) return null

    return (
      <RenameWalletLink
        cancel={() => setConnectionIdToChangeName('')}
        updateName={(updatedName) => updateWalletName(updatedName)}
        initialValue={connections[connectionIdToChangeName].walletName}
      />
    )
  }

  const sendAccountListRequest = (connectionId: string) => {
    const interactionId = crypto.randomUUID()
    if (pendingAccountRequest[connectionId]) return
    setPendingAccountRequest({
      ...pendingAccountRequest,
      [connectionId]: interactionId,
    })

    sendMessage(
      createMessage.sendAccountListRequest(connectionId, interactionId),
    )
  }

  return (
    <>
      <Box
        py="small"
        flex="col"
        style={{
          ...(connectionIdToForget || connectionIdToChangeName
            ? { filter: `blur(10px)`, height: '100%' }
            : { height: '100%' }),
        }}
      >
        <PairingHeader header="Radix Wallet Connector" />
        <Box style={{ maxHeight: 530, overflowY: 'scroll' }}>
          <Box>
            {connectionsClient.entries().map(([id, connection]) => (
              <LinkedWallet
                key={id}
                accounts={connection.accounts}
                name={connection.walletName}
                pendingAccountRequest={!!pendingAccountRequest[id]}
                onForgetWallet={() => setConnectionIdToForget(id)}
                onRequestAccountList={() => sendAccountListRequest(id)}
                onRenameWalletLink={() => setConnectionIdToChangeName(id)}
              />
            ))}
          </Box>
          <Link to="/pairing">
            <Button
              text
              full
              style={{
                fontSize: '16px',
                color: 'white',
                marginTop: '32px',
                fontWeight: 'bold',
              }}
            >
              Link New Wallet
            </Button>
          </Link>
        </Box>
      </Box>
      {renderForgetWalletConfirmation()}
      {renderChangeWalletName()}
    </>
  )
}
