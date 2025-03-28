import { Box, Button } from '../../components'
import { PairingHeader } from './pairing-header'
import { useEffect, useState } from 'react'
import { LinkedWallet } from 'components/linked-wallet/linked-wallet'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useConnectionsClient } from 'pairing/state/connections'
import { ForgetThisWallet } from './forget-this-wallet'
import { RenameWalletLink } from './rename-wallet-link'

/**
 * Main user facing interface
 */
export const ConnectionStatus = () => {
  const navigate = useNavigate()
  const connectionsClient = useConnectionsClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const connections = connectionsClient.connections

  const [connectionIdToForget, setConnectionIdToForget] = useState<string>('')
  const [changingName, setChangingName] = useState<
    { walletPublicKey: string; isInitial: boolean } | undefined
  >(undefined)
  const [recentlyLinkedWallet, setRecentlyLinkedWallet] = useState<
    string | undefined
  >(undefined)

  useEffect(() => {
    if (searchParams.has('newWallet')) {
      const newWalletPublicKey = searchParams.get('newWallet') as string
      const isKnownWallet = searchParams.get('isKnownConnection') === 'true'
      setRecentlyLinkedWallet(newWalletPublicKey)
      setChangingName(
        !isKnownWallet
          ? { walletPublicKey: newWalletPublicKey, isInitial: true }
          : undefined,
      )

      setSearchParams({})
    }
  }, [searchParams])

  useEffect(() => {
    if (connectionsClient.isLoading()) return
    if (!connectionsClient.hasConnections()) {
      navigate('/pairing')
    }
  }, [connections])

  const forgetWallet = () => {
    connectionsClient.remove(connectionIdToForget)
    setConnectionIdToForget('')
  }

  const updateWalletName = (walletName: string) => {
    if (changingName) {
      connectionsClient.updateName(walletName, changingName.walletPublicKey)
      setChangingName(undefined)
    }
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
    if (!changingName || !connections) return null

    return (
      <RenameWalletLink
        cancel={() => setChangingName(undefined)}
        updateName={(updatedName) => updateWalletName(updatedName)}
        isInitial={changingName.isInitial}
        initialValue={connections[changingName.walletPublicKey].walletName}
      />
    )
  }

  return connectionsClient.hasConnections() ? (
    <>
      <Box
        py="small"
        flex="col"
        style={{
          ...(connectionIdToForget || changingName
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
                isJustLinked={recentlyLinkedWallet === id}
                accounts={connection.accounts}
                name={connection.walletName}
                onForgetWallet={() => setConnectionIdToForget(id)}
                onRenameWalletLink={() =>
                  setChangingName({ walletPublicKey: id, isInitial: false })
                }
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
  ) : null
}
