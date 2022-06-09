import Icon from 'components/icon'
import Box from 'components/box'
import Button from 'components/button'
import Clipboard from 'components/clipboard'
import Tooltip from 'components/tooltip'
import QRCode from 'react-qr-code'
import { useOverlayClipboard } from 'hooks'

const Main = () => {
  const QR = useOverlayClipboard(
    <QRCode size={170} value="z4ncptue" />,
    'z4ncptue'
  )
  const Password = useOverlayClipboard(
    <Clipboard value="e565c7765192b7eeeaf8b1937d5321feaeb74cf51bdc9ba09d55ad806ee56b22" />,
    'e565c7765192b7eeeaf8b1937d5321feaeb74cf51bdc9ba09d55ad806ee56b22',
    true
  )
  return (
    <Box p="small" flex="col">
      <Box py="small" items="center" justify="between">
        <img height="18" width="68" src="assets/images/logo.png" />
        <Tooltip description="Re-generate code">
          <Button border="none" ghost size="iconSmall">
            <Icon color="$secondary" size="small" type="refresh" />
          </Button>
        </Tooltip>
      </Box>
      {QR}
      {Password}
      <Button size="small">Connect</Button>
    </Box>
  )
}

export default Main
