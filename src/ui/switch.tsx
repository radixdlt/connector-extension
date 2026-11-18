import type { InputHTMLAttributes } from 'react'

/**
 * The wallet's switch: a native checkbox with the switch role, drawn as a track and
 * a thumb. Name it with a wrapping `<label>` or `aria-label`.
 */
export const Switch = (
  props: Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'role'>,
) => (
  <span className="rdx-switch">
    <input
      {...props}
      type="checkbox"
      role="switch"
      className="rdx-switch__input"
    />
    <span className="rdx-switch__track" aria-hidden="true" />
    <span className="rdx-switch__thumb" aria-hidden="true" />
  </span>
)
