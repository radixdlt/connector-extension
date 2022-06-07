import Box from 'components/box'
import Button from 'components/button'
import QRCode from 'react-qr-code'

const Main = () => {
  return (
    <Box flex="col">
      <Box border>
        <QRCode size={150} value="z4ncptue" />
      </Box>
      <Button css={{ mt: '$sm' }} size="small">
        Connect
      </Button>
    </Box>
  )
}

export default Main
