import React from 'react'
import { ContentCopy, Refresh as RefreshIcon } from '@mui/icons-material'
import Box from 'components/box'
import { theme } from 'stitches.config'

const icons = {
  refresh: RefreshIcon,
  copy: ContentCopy,
}

type IconType = {
  type: keyof typeof icons
  color?: `$${keyof typeof theme['colors']}`
  size?: 'medium' | 'large' | 'small'
} & React.ComponentProps<typeof Box>

const Icon = ({ type, color, size, ...style }: IconType) => {
  const IconToRender = icons[type]
  return (
    <Box justify="center" css={{ color, p: '$0' }} {...style}>
      <IconToRender fontSize={size} />
    </Box>
  )
}

export default Icon
