import { ScanQrCode as ScanQrCodeC } from './components/scan-qr'
import { ConnectionStatus as ConnectionStatusC } from './components/connection-status'
import { config } from '../config'
import { Box } from '../components'

export const ScanQrCode = () => (
  <Box style={{ width: config.popup.width }}>
    <ScanQrCodeC connectionPassword="abc" />
  </Box>
)

export const ConnectionStatus = () => (
  <Box style={{ width: config.popup.width }}>
    <ConnectionStatusC activeConnection={true} onForgetWallet={() => {}} />
  </Box>
)
