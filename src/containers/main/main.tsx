import Icon from 'components/icon'
import Box from 'components/box'
import Button from 'components/button'
import QRCode from 'react-qr-code'

const Main = () => {
  return (
    <Box flex="col">
      <Box items="center" justify="between">
        <img height="18" width="68" src="assets/images/logo.png" />
        <Button ghost size="iconSmall">
          <Icon color="$secondary" size="small" type="refresh" />
        </Button>
      </Box>
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
