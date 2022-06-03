import { styled } from 'stitches.config'

const Button = styled('button', {
  backgroundColor: '$primaryButton',
  border: '1px solid $gray400',
  cursor: 'pointer',
  borderRadius: '$sm',
  fontSize: '$md',
  color: '$white',
  padding: '$md $2xl',
  '&:hover': {
    backgroundColor: '$primaryButtonHover',
    transition: 'color .2s,border-color .2s,background-color .2s',
  },
})

export default Button
