import { styled } from 'stitches.config'

const Box = styled('div', {
  borderWidth: '$sm',
  backgroundColor: 'transparent',
  p: '$sm',
  variants: {
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
        borderRadius: '$sm',
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
  },
})

export default Box
