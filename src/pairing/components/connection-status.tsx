import { Box, Button } from '../../components'
import { PairingHeader } from './pairing-header'
import { StatusIndicator } from './status-indicator'

type ConnectionStatusProps = {
  activeConnection: boolean
  onForgetWallet: () => void
}

export const ConnectionStatus = ({
  activeConnection,
  onForgetWallet,
}: ConnectionStatusProps) => (
  <>
    <PairingHeader header="Radix Wallet Connector">
      This Wallet Connector extension is connected to a Radix Wallet.
    </PairingHeader>
    <Box mb="3xl" mt="md" flex="row">
      <StatusIndicator active={activeConnection}>
        Connection {activeConnection ? 'active' : 'inactive'}
      </StatusIndicator>
    </Box>
    <Box px="medium">
      <Button full onClick={onForgetWallet}>
        Forget this Radix Wallet
      </Button>
    </Box>
  </>
)
