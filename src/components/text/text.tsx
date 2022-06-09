import { styled } from 'stitches.config'

const Text = styled('p', {
  variants: {
    interactive: {
      true: {
        cursor: 'pointer',
        transition: 'color .2s,border-color .2s,background-color .2s',
        '&:hover': {
          color: '$primaryButtonHover',
        },
      },
    },
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
      medium: {
        fontSize: '$md',
      },
      large: {
        fontSize: '$lg',
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
