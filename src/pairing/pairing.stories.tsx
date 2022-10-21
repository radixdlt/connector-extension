import { ConnectionPassword as ConnectionPasswordC } from './components/connection-password'
import { ConnectionStatus as ConnectionStatusC } from './components/connection-status'
import { config } from '../config'
import { Box } from '../components'

export const ConnectionPassword = () => (
  <Box style={{ width: config.popup.width }}>
    <ConnectionPasswordC value="abc" />
  </Box>
)

export const ConnectionStatus = () => (
  <Box style={{ width: config.popup.width }}>
    <ConnectionStatusC activeConnection={true} onForgetWallet={() => {}} />
  </Box>
)
