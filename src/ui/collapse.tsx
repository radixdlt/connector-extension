import type { ReactNode } from 'react'
import './collapse.css'

/**
 * Content that opens and closes with a height animation. Closed, it is hidden
 * from assistive technology and the keyboard as well.
 */
export const Collapse = ({
  open,
  children,
}: {
  open: boolean
  children: ReactNode
}) => (
  <div className={`rdx-collapse${open ? ' rdx-collapse--open' : ''}`}>
    <div className="rdx-collapse__content">{children}</div>
  </div>
)
