import { styled } from 'stitches.config'

const Button = styled('button', {
  backgroundColor: '$primaryButton',
  border: '1px solid $gray400',
  cursor: 'pointer',
  borderRadius: '$sm',
  fontSize: '$md',
  color: '$white',
  padding: '$sm $xl',
  '&:hover': {
    backgroundColor: '$gray400',
  },
})

export default Button
