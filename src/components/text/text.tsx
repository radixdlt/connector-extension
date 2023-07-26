import { styled } from '../../stitches.config'
import { m } from 'components/variants'

export const Text = styled('p', {
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
      xSmall: {
        fontSize: '$xs',
      },
      small: {
        fontSize: '$sm',
      },
      medium: {
        fontSize: '$md',
      },
      large: {
        fontSize: '$lg',
      },
      '2xl': {
        fontSize: '$2xl',
      },
      '4xl': {
        fontSize: '$4xl',
        fontWeight: '700',
      },
    },
    color: {
      radixGrey2: { color: '$radixGrey2' },
      radixGrey1: { color: '$radixGrey1' },
    },
    bold: {
      true: {
        fontWeight: '$600',
      },
    },
    italic: {
      true: {
        fontStyle: 'italic',
      },
    },
    medium: {
      true: {
        fontWeight: '$500',
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
    ...m,
  },
})
