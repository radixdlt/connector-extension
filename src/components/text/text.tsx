import type { HTMLAttributes } from 'react'
import {
  classNames,
  modifiers,
  withMargins,
  type MarginProps,
} from '../variants'

export type TextProps = HTMLAttributes<HTMLParagraphElement> &
  MarginProps & {
    size?: 'xSmall' | 'small' | 'medium' | 'large' | '2xl' | '4xl'
    color?: 'radixGrey1' | 'radixGrey2'
    bold?: boolean
    medium?: boolean
    italic?: boolean
    muted?: boolean
    inline?: boolean
    ellipsis?: boolean
    negativeMarginBottom?: boolean
  }

/** A paragraph with text variants. */
export const Text = (props: TextProps) => {
  const [margins, rest] = withMargins(props)
  const {
    size,
    color,
    bold,
    medium,
    italic,
    muted,
    inline,
    ellipsis,
    negativeMarginBottom,
    className,
    ...attributes
  } = rest
  return (
    <p
      {...attributes}
      className={classNames(
        modifiers('rdx-text', {
          size,
          color,
          bold,
          medium,
          italic,
          muted,
          inline,
          ellipsis,
          negativeMarginBottom,
        }),
        margins,
        className,
      )}
    />
  )
}
