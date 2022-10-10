import { styled } from '../../stitches.config'

export const Link = styled('a', {
  textDecoration: 'underline',
  fontSize: '$sm',
  '&:visited': {
    color: '$primary',
  },
})
