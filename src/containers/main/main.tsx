import Icon from 'components/icon'
import Box from 'components/box'
import Button from 'components/button'
import QRCode from 'react-qr-code'
import Clipboard from 'components/clipboard'
import Tooltip from 'components/tooltip'

const Main = () => (
  <Box p="small" flex="col">
    <Box py="small" items="center" justify="between">
      <img height="18" width="68" src="assets/images/logo.png" />
      <Tooltip description="Re-generate code">
        <Button border="none" ghost size="iconSmall">
          <Icon color="$secondary" size="small" type="refresh" />
        </Button>
      </Tooltip>
    </Box>
    <Box px="small" border>
      <QRCode size={150} value="z4ncptue" />
    </Box>
    <Box>
      <Tooltip description="Click to copy">
        <Clipboard>
          e565c7765192b7eeeaf8b1937d5321feaeb74cf51bdc9ba09d55ad806ee56b22
        </Clipboard>
      </Tooltip>
    </Box>
    <Button size="small">Connect</Button>
  </Box>
)

export default Main
