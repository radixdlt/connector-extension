import { styled } from '../../stitches.config'
import { m } from '../variants'

export const Box = styled('div', {
  boxSizing: 'border-box',
  variants: {
    full: {
      true: {
        width: '100%',
      },
    },
    pointer: {
      true: {
        cursor: 'pointer',
      },
    },
    rounded: {
      true: {
        borderRadius: '16px',
      },
    },
    interactive: {
      true: {
        cursor: 'pointer',
        transition: 'color .2s,border-color .2s,background-color .2s',
        '&:hover': {
          backgroundColor: '$grey',
        },
      },
    },
    maxWidth: {
      medium: {
        maxWidth: '600px',
      },
    },
    radius: {
      small: {
        borderRadius: '8px',
      },
      medium: {
        borderRadius: '12px',
      },
      large: {
        borderRadius: '16px',
      },
    },
    bg: {
      dark: {
        backgroundColor: 'rgba(0,0,0,0.5)',
      },
      white: {
        backgroundColor: 'white',
      },
    },
    p: {
      xsmall: {
        p: '$xs',
      },
      small: {
        p: '$sm',
      },
      medium: {
        p: '$md',
      },
      large: {
        p: '$lg',
      },
      none: {
        p: '$0',
      },
    },
    py: {
      xsmall: {
        py: '$xs',
      },
      small: {
        py: '$sm',
      },
      medium: {
        py: '$md',
      },
      large: {
        py: '$lg',
      },
      none: {
        py: '$0',
      },
    },
    px: {
      xsmall: {
        px: '$xs',
      },
      small: {
        px: '$sm',
      },
      medium: {
        px: '$md',
      },
      large: {
        px: '$lg',
      },
      none: {
        px: '$0',
      },
    },
    border: {
      true: {
        borderColor: '$borderColor',
        borderStyle: 'solid',
      },
    },
    flex: {
      row: {
        display: 'flex',
        flexDirection: 'row',
      },
      col: {
        display: 'flex',
        flexDirection: 'column',
      },
    },
    items: {
      start: {
        display: 'flex',
        justifyContent: 'flex-start',
      },
      center: {
        display: 'flex',
        alignItems: 'center',
      },
      between: {
        display: 'flex',
        alignItems: 'space-between',
      },
      around: {
        display: 'flex',
        alignItems: 'space-around',
      },
      evenly: {
        display: 'flex',
        alignItems: 'space-evenly',
      },
    },
    justify: {
      start: {
        display: 'flex',
        justifyContent: 'flex-start',
      },
      center: {
        display: 'flex',
        justifyContent: 'center',
      },
      between: {
        display: 'flex',
        justifyContent: 'space-between',
      },
      around: {
        display: 'flex',
        justifyContent: 'space-around',
      },
      evenly: {
        display: 'flex',
        justifyContent: 'space-evenly',
      },
    },
    position: {
      relative: {
        position: 'relative',
      },
      absolute: {
        position: 'absolute',
      },
    },
    textAlign: {
      left: { textAlign: 'left' },
      center: { textAlign: 'center' },
      right: { textAlign: 'right' },
    },
    ...m,
  },
})
