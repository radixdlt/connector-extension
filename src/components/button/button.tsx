import { styled } from 'stitches.config'

const Button = styled('button', {
  backgroundColor: '$primaryButton',
  border: '1px solid $gray400',
  cursor: 'pointer',
  borderRadius: '$sm',
  fontSize: '$md',
  color: '$white',
  padding: '$md $2xl',
  transition: 'color .2s,border-color .2s,background-color .2s',
  '&:hover': {
    backgroundColor: '$primaryButtonHover',
  },
  variants: {
    size: {
      small: {
        padding: '$sm $xl',
      },
    },
    ghost: {
      true: {
        backgroundColor: '$white',
        color: '$primaryText',
        '&:hover': {
          backgroundColor: '$ghostButtonHover',
          color: '$white',
        },
      },
    },
  },
})

export default Button
