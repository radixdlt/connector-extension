import { Box, Button } from '../../components'
import { PairingHeader } from './pairing-header'

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
    <Box px="medium" mt="3xl">
      <Button full onClick={onForgetWallet}>
        Forget this Radix Wallet
      </Button>
    </Box>
  </>
)
