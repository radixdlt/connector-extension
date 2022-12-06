import { styled } from '../../stitches.config'
import { mb } from '../variants/mb'

export const Header = styled('h1', {
  fontSize: '$4xl',
  fontWeight: '$600',
  lineHeight: '36px',
  variants: {
    mb,
  },
  color: 'white',
})
