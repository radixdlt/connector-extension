import type { HTMLAttributes } from 'react'
import {
  classNames,
  modifiers,
  withMargins,
  type MarginProps,
} from '../variants'

export type HeaderProps = HTMLAttributes<HTMLHeadingElement> &
  Pick<MarginProps, 'mb'> & { dark?: boolean }

export const Header = (props: HeaderProps) => {
  const [margins, rest] = withMargins(props)
  const { dark, className, ...attributes } = rest
  return (
    <h1
      {...attributes}
      className={classNames(
        'rdx-header',
        modifiers('rdx-header', { dark }),
        margins,
        className,
      )}
    />
  )
}
