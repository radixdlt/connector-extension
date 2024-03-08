import { m } from 'components/variants'
import { styled } from '../../stitches.config'

export const Button = styled('button', {
  backgroundColor: '$primaryButton',
  borderWidth: 0,
  cursor: 'pointer',
  boxSizing: 'border-box',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '4px',
  borderRadius: '12px',
  fontWeight: '$600',
  color: '$primaryButtonText',
  px: '$lg',
  py: '$sm',

  variants: {
    ...m,
    px: {
      '2xl': {
        paddingLeft: '$2xl',
        paddingRight: '$2xl',
      },
    },
    full: {
      true: {
        width: '$1',
      },
    },
    disabled: {
      true: {
        backgroundColor: '$secondaryButton',
        color: 'rgba(208,208,214,1)',
        cursor: 'not-allowed',
        pointerEvents: 'none',
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
    secondary: {
      true: {
        backgroundColor: '$secondaryButton',
        color: '$secondaryButtonText',
        '&:hover': {
          backgroundColor: '$secondaryButton',
          boxShadow: 'none',
        },
      },
    },
    text: {
      true: {
        backgroundColor: 'rgba(0,0,0,0)',
        color: '$textButtonText',
        '&:hover': {
          backgroundColor: 'rgba(0,0,0,0)',
          boxShadow: 'none',
        },
      },
    },
  },
})
