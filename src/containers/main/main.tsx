import Icon from 'components/icon'
import Box from 'components/box'
import Button from 'components/button'
import Tooltip from 'components/tooltip'
import Encryptionkey from 'containers/encryptionkey'

const Main = () => (
  <Box css={{ width: '180px', height: '340px' }} p="small" flex="col">
    <Box py="small" items="center" justify="between">
      <img height="18" width="68" src="assets/images/logo.png" />
      <Tooltip description="Re-generate code">
        <Button border="none" ghost size="iconSmall">
          <Icon color="$secondary" size="small" type="refresh" />
        </Button>
      </Tooltip>
    </Box>
    <Encryptionkey />
  </Box>
)

export default Main
