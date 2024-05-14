import { styled } from '../../stitches.config'
import { Box } from '../box'

export const PopupWindow = styled(Box, {
  padding: '18px 32px',
  position: 'relative',
  height: '100%',
  boxSizing: 'border-box',
  display: 'flex',
  justifyContent: 'space-between',
  flexDirection: 'column',
  variants: {
    content: {
      start: {
        justifyContent: 'flex-start',
      },
    },
    items: {
      center: {
        alignItems: 'center',
      },
    },
  },
})
