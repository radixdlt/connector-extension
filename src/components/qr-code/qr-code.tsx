import { Box } from '../box'
import QRCode from 'react-qr-code'

type QrCodeProps = {
  value: string
}

export const QrCode = ({ value }: QrCodeProps) => (
  <Box justify="center" p="none" mb="2xl">
    <Box
      p="medium"
      style={{ background: '#ECECEC', borderColor: 'black' }}
      border="true"
    >
      <QRCode bgColor="#ECECEC" size={162} value={value} />
    </Box>
  </Box>
)
