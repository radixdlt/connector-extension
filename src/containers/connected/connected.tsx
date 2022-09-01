import Box from 'components/box'
import Icon from 'components/icon'
import Text from 'components/text'

export const Connected = () => (
  <Box css={{ height: '250px' }} justify="center" items="center" flex="col">
    <Box>
      <Icon color="$success" type="check" />
      <Text ml="xsmall">Connected</Text>
    </Box>
  </Box>
)
