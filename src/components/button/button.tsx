import { styled } from '../../stitches.config'

export const Button = styled('button', {
  backgroundColor: '$primaryButton',
  borderWidth: 0,
  borderColor: '$borderColor',
  borderStyle: 'solid',
  cursor: 'pointer',
  borderRadius: '$sm',
  fontSize: '$xs',
  fontWeight: '$600',
  color: '$primaryButtonText',
  px: '$lg',
  py: '$sm',
  transition: 'color .2s,border-color .2s,background-color .2s',
  '&:hover': {
    backgroundColor: '$primaryButtonHover',
  },
  lineHeight: 1.5,
  boxShadow: '0px 4px 4px rgba(0, 0, 0, 0.25)',
  variants: {
    mt: {
      large: {
        marginTop: '$lg',
      },
    },
    mb: {
      small: {
        marginBottom: '$sm',
      },
    },
    mr: {
      small: {
        marginRight: '$sm',
      },
    },
    ml: {
      small: {
        marginLeft: '$sm',
      },
    },
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
    border: {
      none: {
        borderWidth: '0',
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
    text: {
      true: {
        backgroundColor: 'rgba(0,0,0,0)',
        boxShadow: '0px 4px 4px rgba(0, 0, 0, 0)',
        color: '$primaryGhostButton',
        '&:hover': {
          backgroundColor: 'rgba(0,0,0,0)',
          color: '$primaryGhostButton',
        },
      },
    },
  },
})
