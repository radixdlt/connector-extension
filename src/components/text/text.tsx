import { styled } from 'stitches.config'

const Text = styled('p', {
  variants: {
    highlight: {
      false: {
        userSelect: 'none',
      },
    },
    ellipsis: {
      true: {
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      },
    },
    size: {
      small: {
        fontSize: '$sm',
      },
    },
    bold: {
      true: {
        fontWeight: '$600',
      },
    },
    muted: {
      true: {
        color: '$muted',
      },
    },
    inline: {
      true: {
        display: 'inline',
      },
    },
    my: {
      xsmall: {
        my: '$xs',
      },
      small: {
        my: '$sm',
      },
      medium: {
        my: '$md',
      },
      large: {
        my: '$lg',
      },
      none: {
        my: '$0',
      },
    },
    ml: {
      xsmall: {
        ml: '$xs',
      },
      small: {
        ml: '$sm',
      },
      medium: {
        ml: '$md',
      },
      large: {
        ml: '$lg',
      },
      none: {
        ml: '$0',
      },
    },
  },
})

export default Text
