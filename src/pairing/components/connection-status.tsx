import { Box, Button, Text } from '../../components'
import { PairingHeader } from './pairing-header'
import WalletConnectedIcon from '../assets/wallet-connect-active-icon.svg'

type ConnectionStatusProps = {
  activeConnection: boolean
  onForgetWallet: () => void
}

export const ConnectionStatus = ({
  activeConnection,
  onForgetWallet,
}: ConnectionStatusProps) => (
  <>
    <Box>
      <PairingHeader header="Radix Wallet Connector" />
      <Box
        mt="3xl"
        style={{
          background: 'white',
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
        onClick={onForgetWallet}
        style={{ fontSize: '16px', color: 'white', fontWeight: 'bold' }}
      >
        Forget this Radix Wallet
      </Button>
    </Box>
  </>
)
