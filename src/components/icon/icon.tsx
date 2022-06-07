import { ContentCopy, Refresh as RefreshIcon } from '@mui/icons-material'
import Box from 'components/box'
import { theme } from 'stitches.config'

const icons = {
  refresh: <RefreshIcon />,
  copy: <ContentCopy />,
}

interface IconType {
  type: keyof typeof icons
  color?: `$${keyof typeof theme['colors']}`
}

const Icon = ({ type, color }: IconType) => {
  return <Box css={{ color }}>{icons[type]}</Box>
}

export default Icon
