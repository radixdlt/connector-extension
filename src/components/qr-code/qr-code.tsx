import { Box } from '../box'
import QRCode from 'react-qr-code'

type QrCodeProps = {
  value: string
}

export const QrCode = ({ value }: QrCodeProps) => (
  <Box justify="center" p="none" mb="xl">
    <Box
      style={{
        background: '#ECECEC',
        borderRadius: '16px',
        padding: '20px',
      }}
      border="true"
    >
      <QRCode bgColor="#ECECEC" size={162} value={value} />
    </Box>
  </Box>
)
