import {
  useEffect,
  useId,
  useRef,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react'
import { CloseIcon } from './icons'
import './dialog.css'

/**
 * A modal dialog in the theme's palette, near the top of the page: a close
 * button in its corner, an icon, a title and what it is about, its content (e.g.
 * a `DialogField`), and its action as a full-width button. `tone: 'danger'` is
 * for an action that cannot be undone: its icon and button take the warning
 * colour. The close button and Escape call `onCancel`; focus starts on the first
 * field, its proposed value selected so that typing replaces it, or the action.
 */
export const Dialog = ({
  title,
  description,
  icon,
  tone,
  children,
  cancelLabel = 'Close',
  confirmLabel,
  confirmDisabled,
  onCancel,
  onConfirm,
}: {
  title: string
  description?: ReactNode
  icon?: ReactNode
  tone?: 'danger'
  children?: ReactNode
  cancelLabel?: string
  confirmLabel: string
  confirmDisabled?: boolean
  onCancel: () => void
  onConfirm: () => void
}) => {
  const titleId = useId()
  const descriptionId = useId()
  const panel = useRef<HTMLFormElement>(null)

  useEffect(() => {
    const first = panel.current?.querySelector<HTMLElement>(
      'input, .rdx-dialog__button--primary',
    )
    first?.focus()
    if (first instanceof HTMLInputElement) first.select()
  }, [])

  return (
    <div className="rdx-dialog" role="presentation">
      <form
        ref={panel}
        className={`rdx-dialog__panel${
          tone === 'danger' ? ' rdx-dialog__panel--danger' : ''
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onCancel()
        }}
        onSubmit={(event) => {
          event.preventDefault()
          if (!confirmDisabled) onConfirm()
        }}
      >
        <button
          type="button"
          className="rdx-dialog__close"
          aria-label={cancelLabel}
          title={cancelLabel}
          onClick={onCancel}
        >
          <CloseIcon />
        </button>
        <div className="rdx-dialog__header">
          {icon && (
            <span className="rdx-dialog__icon" aria-hidden="true">
              {icon}
            </span>
          )}
          <h2 id={titleId} className="rdx-dialog__title">
            {title}
          </h2>
          {description && (
            <p id={descriptionId} className="rdx-dialog__text">
              {description}
            </p>
          )}
        </div>
        {children}
        <div className="rdx-dialog__actions">
          <button
            type="submit"
            className="rdx-dialog__button rdx-dialog__button--primary"
            disabled={confirmDisabled}
          >
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>
  )
}

/**
 * A labelled text field of a dialog, with a hint below it, or its error (said to
 * assistive technology as soon as it shows).
 */
export const DialogField = ({
  label,
  hint,
  error,
  ...input
}: {
  label: string
  hint?: ReactNode
  error?: ReactNode
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'id'>) => {
  const id = useId()
  const noteId = useId()
  const note = error ?? hint
  return (
    <div className="rdx-dialog__field">
      <label className="rdx-dialog__label" htmlFor={id}>
        {label}
      </label>
      <input
        {...input}
        id={id}
        className="rdx-dialog__input"
        aria-invalid={error ? true : undefined}
        aria-describedby={note ? noteId : undefined}
      />
      {note && (
        <p
          id={noteId}
          className={error ? 'rdx-dialog__error' : 'rdx-dialog__hint'}
          role={error ? 'alert' : undefined}
        >
          {note}
        </p>
      )}
    </div>
  )
}
