import { Box, Button, Text } from '../../components'
import { PairingHeader } from './pairing-header'
import WalletConnectedIcon from '../assets/wallet-connect-active-icon.svg'
import { useState } from 'react'

type ConnectionStatusProps = {
  onForgetWallet: () => void
}

export const ConnectionStatus = ({ onForgetWallet }: ConnectionStatusProps) => {
  const [isConfirming, setIsConfirming] = useState(false)

  const renderConfirmation = () => {
    if (!isConfirming) return null

    return (
      <Box
        position="absolute"
        bg="dark"
        style={{ margin: '-17px -32px', height: '100vh' }}
        full
        items="center"
        justify="center"
      >
        <Box
          flex="col"
          bg="white"
          p="medium"
          style={{
            borderRadius: '16px',
            maxWidth: '75vw',
          }}
        >
          <Text
            mt="md"
            style={{
              color: '#003057',
              fontSize: '18px',
              fontWeight: '600',
              textAlign: 'center',
            }}
          >
            Forget Wallet
          </Text>
          <Text
            style={{
              color: '#8A8FA4',
              margin: '16px 0',
              fontSize: '14px',
              textAlign: 'center',
            }}
          >
            This browser will no longer connect to your Radix Wallet
          </Text>
          <Box items="center" style={{ gap: '8px' }}>
            <Button secondary onClick={() => setIsConfirming(false)}>
              Cancel
            </Button>
            <Button onClick={() => onForgetWallet()} full>
              Forget
            </Button>
          </Box>
        </Box>
      </Box>
    )
  }
  return (
    <>
      <Box
        flex="col"
        justify="between"
        style={
          isConfirming
            ? { filter: `blur(10px)`, height: '100%' }
            : { height: '100%' }
        }
      >
        <Box>
          <PairingHeader header="Radix Wallet Connector" />
          <Box
            mt="3xl"
            bg="white"
            style={{
              borderRadius: '16px',
              boxShadow: '0px 4px 7px rgba(0, 0, 0, 0.25)',
              padding: '30px',
              display: 'flex',
            }}
          >
            <img src={WalletConnectedIcon} />
            <Box style={{ marginLeft: '20px' }}>
              <Text
                style={{
                  color: '#003057',
                  fontSize: '16px',
                  lineHeight: '23px',
                  fontWeight: '600',
                }}
              >
                Radix Wallet linked
              </Text>
              <Text style={{ color: '#8A8FA4' }}>to this web browser</Text>
            </Box>
          </Box>
        </Box>
        <Box px="medium" mt="3xl" style={{ textAlign: 'center' }}>
          <Button
            text
            onClick={() => {
              setIsConfirming(true)
            }}
            style={{ fontSize: '16px', color: 'white', fontWeight: 'bold' }}
          >
            Forget this Radix Wallet
          </Button>
        </Box>
      </Box>
      {renderConfirmation()}
    </>
  )
}
