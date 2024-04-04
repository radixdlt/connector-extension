import { Box, Button } from '../../components'
import { PairingHeader } from './pairing-header'
import { useEffect, useState } from 'react'
import { LinkedWallet } from 'components/linked-wallet/linked-wallet'
import { Link, useNavigate } from 'react-router-dom'
import { useConnectionsClient } from 'pairing/state/connections'
import { ForgetThisWallet } from './forget-this-wallet'
import { RenameWalletLink } from './rename-wallet-link'

export const ConnectionStatus = () => {
  const navigate = useNavigate()
  const connectionsClient = useConnectionsClient()
  const connections = connectionsClient.connections
  const [connectionIdToForget, setConnectionIdToForget] = useState<string>('')
  const [connectionIdToChangeName, setConnectionIdToChangeName] =
    useState<string>('')

  useEffect(() => {
    if (connectionsClient.isLoading()) return
    if (connectionsClient.hasNoConnections()) {
      navigate('/pairing')
    }
  }, [connections])

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
                accounts={[]}
                name={connection.walletName}
                onForgetWallet={() => setConnectionIdToForget(id)}
                onRequestAccountList={() => {}}
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
