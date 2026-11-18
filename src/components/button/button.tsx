import type { ButtonHTMLAttributes } from 'react'
import {
  classNames,
  modifiers,
  withMargins,
  type MarginProps,
} from '../variants'

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  MarginProps & {
    px?: '2xl'
    full?: boolean
    size?: 'small' | 'iconSmall'
    secondary?: boolean
  }

/** The primary button of the ledger page and the dev tools. */
export const Button = (props: ButtonProps) => {
  const [margins, rest] = withMargins(props)
  const { px, full, size, secondary, disabled, className, ...attributes } = rest
  return (
    <button
      {...attributes}
      disabled={disabled}
      className={classNames(
        'rdx-button',
        modifiers('rdx-button', { px, full, size, secondary, disabled }),
        margins,
        className,
      )}
    />
  )
}
