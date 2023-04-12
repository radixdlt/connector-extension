import { Box } from 'components'
import { LedgerSimulator } from './components/LedgerSimulator'
import { WalletSimulator } from './components/WalletSimulator'

export const DevTools = () => (
  <Box flex="row">
    <WalletSimulator />
    <LedgerSimulator />
  </Box>
)
