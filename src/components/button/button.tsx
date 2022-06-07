import { styled } from 'stitches.config'

const Button = styled('button', {
  backgroundColor: '$primaryButton',
  borderWidth: '$sm',
  borderColor: '$borderColor',
  borderStyle: 'solid',
  cursor: 'pointer',
  borderRadius: '$sm',
  fontSize: '$md',
  color: '$primaryButtonText',
  padding: '$md $2xl',
  transition: 'color .2s,border-color .2s,background-color .2s',
  '&:hover': {
    backgroundColor: '$primaryButtonHover',
  },
  variants: {
    full: {
      true: {
        width: '$1',
      },
    },
    size: {
      small: {
        padding: '$sm $xl',
        fontSize: '$sm',
      },
      iconSmall: {
        padding: '$xs',
        fontSize: '0',
      },
    },
    ghost: {
      true: {
        backgroundColor: '$primaryGhostButton',
        color: '$primaryGhostButtonText',
        '&:hover': {
          backgroundColor: '$primaryGhostButtonHover',
          color: '$primaryGhostButtonHoverText',
        },
      },
    },
  },
})

export default Button
