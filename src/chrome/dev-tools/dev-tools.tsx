import { Box } from 'components'
import { LedgerSimulator } from './components/LedgerSimulator'
import { WalletSimulator } from './components/WalletSimulator'
import { NotificationsSimulator } from './components/NotificationsSimulator'

export const DevTools = () => (
  <Box p="large">
    <Box flex="row">
      <WalletSimulator />
      <LedgerSimulator />
    </Box>
    <Box bg="white" p="medium" rounded mt="lg">
      <NotificationsSimulator />
    </Box>
  </Box>
)
