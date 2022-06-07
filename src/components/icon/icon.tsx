import { ContentCopy, Refresh as RefreshIcon } from '@mui/icons-material'
import Box from 'components/box'
import { theme } from 'stitches.config'

const icons = {
  refresh: RefreshIcon,
  copy: ContentCopy,
}

interface IconType {
  type: keyof typeof icons
  color?: `$${keyof typeof theme['colors']}`
  size?: 'medium' | 'large' | 'small'
}

const Icon = ({ type, color, size }: IconType) => {
  const IconToRender = icons[type]
  return (
    <Box css={{ color, p: '$0' }}>
      <IconToRender fontSize={size} />
    </Box>
  )
}

export default Icon
