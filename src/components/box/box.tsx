import { forwardRef, type HTMLAttributes } from 'react'
import {
  classNames,
  modifiers,
  withMargins,
  type MarginProps,
} from '../variants'

type Padding = 'none' | 'xsmall' | 'small' | 'medium' | 'large'

export type BoxProps = HTMLAttributes<HTMLDivElement> &
  MarginProps & {
    full?: boolean
    rounded?: boolean
    radius?: 'small' | 'medium' | 'large'
    bg?: 'white' | 'dark'
    border?: boolean | 'true'
    p?: Padding
    px?: Padding
    py?: Padding
    flex?: 'row' | 'col'
    items?: 'start' | 'center'
    justify?: 'start' | 'center' | 'between'
    position?: 'relative' | 'absolute'
    textAlign?: 'left' | 'center' | 'right'
    maxWidth?: 'medium'
  }

/** A `div` with layout variants. */
export const Box = forwardRef<HTMLDivElement, BoxProps>((props, ref) => {
  const [margins, rest] = withMargins(props)
  const {
    full,
    rounded,
    radius,
    bg,
    border,
    p,
    px,
    py,
    flex,
    items,
    justify,
    position,
    textAlign,
    maxWidth,
    className,
    ...attributes
  } = rest
  return (
    <div
      ref={ref}
      {...attributes}
      className={classNames(
        'rdx-box',
        modifiers('rdx-box', {
          full,
          rounded,
          radius,
          bg,
          border,
          p,
          px,
          py,
          flex,
          items,
          justify,
          position,
          textAlign,
          maxWidth,
        }),
        margins,
        className,
      )}
    />
  )
})
Box.displayName = 'Box'
