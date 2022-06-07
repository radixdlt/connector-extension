import Icon from '../icon'
import Box from 'components/box'
import Text from 'components/text'

interface ClipboardType {
  children: string
}

const Clipboard = ({ children }: ClipboardType) => (
  <Box
    px="small"
    py="none"
    border
    justify="between"
    items="center"
    interactive
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
        {children}
      </Text>
    </Box>
    <Icon size="small" type="copy" />
  </Box>
)

export default Clipboard
