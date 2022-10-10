import { styled } from '../../stitches.config'
import { mb } from '../variants/mb'

export const Header = styled('h1', {
  fontSize: '$xl',
  fontWeight: '$600',
  lineHeight: '26px',
  variants: {
    mb,
  },
})
