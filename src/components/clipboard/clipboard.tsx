import Icon from '../icon'
import Box from 'components/box'
import Text from 'components/text'

interface ClipboardType {
  value: string
}

const Clipboard = ({ value }: ClipboardType) => (
  <Box
    full
    px="small"
    py="none"
    border
    justify="between"
    items="center"
    flex="row"
  >
    <Box css={{ overflow: 'hidden' }} py="none" items="center">
      <Text
        css={{ overflow: 'hidden', maxWidth: '120px' }}
        highlight={false}
        ellipsis
        size="small"
        my="small"
        muted
      >
        {value}
      </Text>
    </Box>
    <Icon size="small" type="copy" />
  </Box>
)

export default Clipboard
