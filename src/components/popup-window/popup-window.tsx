import type { HTMLAttributes } from 'react'
import { classNames, modifiers } from '../variants'

export type PopupWindowProps = HTMLAttributes<HTMLDivElement> & {
  content?: 'start'
  items?: 'center'
}

/** A page's frame: its content in a column, the full height of the window. */
export const PopupWindow = ({
  content,
  items,
  className,
  ...attributes
}: PopupWindowProps) => (
  <div
    {...attributes}
    className={classNames(
      'rdx-popup-window',
      modifiers('rdx-popup-window', { content, items }),
      className,
    )}
  />
)
