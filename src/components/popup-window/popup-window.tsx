import { styled } from '../../stitches.config'
import { Box } from '../box'

export const PopupWindow = styled(Box, {
  padding: '18px 32px',
  position: 'relative',
  height: 'calc(100% - 28px)',
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  variants: {
    content: {
      start: {
        justifyContent: 'flex-start',
      },
    },
  },
})
