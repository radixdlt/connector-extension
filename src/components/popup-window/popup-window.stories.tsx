import { Header } from '../header'
import { Text } from '../text'
import { QrCode } from '../qr-code'
import { PopupWindow as PopupWindowC } from './popup-window'
import { Link } from '../link'
import { Box } from '../box'

export const ScanQrCode = () => (
  <PopupWindowC>
    <Header>Radix Wallet Connector</Header>
    <Text size="xSmall" color="radixGrey2" style={{ lineHeight: '15.6px' }}>
      Scan the QR code with Radix Wallet on your mobile phone to start using it
      with dApps in this web browser.
    </Text>
    <QrCode value={crypto.randomUUID()} />
    <Box textAlign="center">
      <Link href="https://radixdlt.com" target="_blank">
        Don’t have Radix Wallet?
      </Link>
    </Box>
  </PopupWindowC>
)
