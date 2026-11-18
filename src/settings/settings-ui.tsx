import {
  useEffect,
  useId,
  useRef,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react'
import { BackIcon, ChevronRightIcon } from 'ui/icons'
import { Switch } from 'ui/switch'
import 'ui/tokens.css'
import './settings.css'

/**
 * A settings screen: the wallet's top bar (back arrow, centred title) over a
 * scrolling grouped list. `page`: the options page (a full page, taller rows).
 */
export const SettingsPage = ({
  title,
  onBack,
  backLabel = 'Back',
  page,
  children,
}: {
  title: string
  onBack?: () => void
  backLabel?: string
  page?: boolean
  children: ReactNode
}) => {
  const heading = useRef<HTMLHeadingElement>(null)

  // Keyboard and screen reader users start at the top of the new screen.
  useEffect(() => {
    heading.current?.focus({ preventScroll: true })
  }, [title])

  return (
    <div
      className={`rdx-settings${page ? ' rdx-settings--page' : ''}`}
      data-testid="settings-page"
    >
      <header className="rdx-top-bar">
        {onBack && (
          <button
            type="button"
            className="rdx-icon-button"
            aria-label={backLabel}
            title={backLabel}
            onClick={onBack}
          >
            <BackIcon />
          </button>
        )}
        <h1 className="rdx-top-bar__title" tabIndex={-1} ref={heading}>
          {title}
        </h1>
      </header>
      <main className="rdx-settings__content">
        <div className="rdx-settings__column">{children}</div>
      </main>
    </div>
  )
}

/**
 * A titled group of rows, with an optional explanation below it. `radioGroup`: its
 * rows are the choices of one radio group, named by the title.
 */
export const SettingsSection = ({
  title,
  description,
  footer,
  radioGroup,
  children,
}: {
  title?: string
  /** What the section is about: under its title, before its rows. */
  description?: ReactNode
  /** A message about the section (e.g. an error), below its rows. */
  footer?: ReactNode
  radioGroup?: boolean
  children: ReactNode
}) => {
  const id = useId()
  return (
    <section
      className="rdx-section"
      aria-labelledby={title ? `${id}-title` : undefined}
    >
      {title && (
        <h2 id={`${id}-title`} className="rdx-section__header">
          {title}
        </h2>
      )}
      {description && (
        <p id={`${id}-description`} className="rdx-section__description">
          {description}
        </p>
      )}
      <ul
        className="rdx-group"
        role={radioGroup ? 'radiogroup' : undefined}
        aria-labelledby={radioGroup && title ? `${id}-title` : undefined}
        aria-describedby={description ? `${id}-description` : undefined}
      >
        {children}
      </ul>
      {footer && <p className="rdx-section__footer">{footer}</p>}
    </section>
  )
}

const RowText = ({
  title,
  subtitle,
  subtitleId,
  icon,
}: {
  title: ReactNode
  subtitle?: ReactNode
  subtitleId?: string
  /** A leading icon, as in the wallet's settings lists. */
  icon?: ReactNode
}) => (
  <>
    {icon && <span className="rdx-row__icon">{icon}</span>}
    <span className="rdx-row__text">
      <span className="rdx-row__title">{title}</span>
      {subtitle && (
        <span className="rdx-row__subtitle" id={subtitleId}>
          {subtitle}
        </span>
      )}
    </span>
  </>
)

/**
 * A row. With `onClick`: a button, with a chevron (`trailing` replaces it), e.g. to
 * open a sub-page. Without: information, with an optional `value` on the right.
 */
export const SettingsRow = ({
  title,
  subtitle,
  value,
  onClick,
  trailing,
  testId,
  icon,
}: {
  title: ReactNode
  subtitle?: ReactNode
  icon?: ReactNode
  value?: ReactNode
  onClick?: () => void
  trailing?: ReactNode
  testId?: string
}) => (
  <li>
    {onClick ? (
      <button
        type="button"
        className="rdx-row"
        onClick={onClick}
        data-testid={testId}
      >
        <RowText title={title} subtitle={subtitle} icon={icon} />
        {value !== undefined && <span className="rdx-row__value">{value}</span>}
        <span className="rdx-row__trailing">
          {trailing ?? <ChevronRightIcon />}
        </span>
      </button>
    ) : (
      <div className="rdx-row" data-testid={testId}>
        <RowText title={title} subtitle={subtitle} icon={icon} />
        {value !== undefined && <span className="rdx-row__value">{value}</span>}
        {trailing && <span className="rdx-row__trailing">{trailing}</span>}
      </div>
    )}
  </li>
)

/** A row with the wallet's switch: the whole row toggles it. */
export const SwitchRow = ({
  title,
  subtitle,
  checked,
  disabled,
  onChange,
  icon,
}: {
  title: string
  subtitle?: string
  icon?: ReactNode
  /** `undefined` while not known yet (still being read). */
  checked: boolean | undefined
  disabled?: boolean
  onChange: (checked: boolean) => void
}) => {
  const id = useId()
  return (
    <li>
      <label
        className={`rdx-row${disabled ? ' rdx-row--disabled' : ''}`}
        htmlFor={id}
      >
        <RowText
          title={title}
          subtitle={subtitle}
          subtitleId={subtitle ? `${id}-subtitle` : undefined}
          icon={icon}
        />
        {checked === undefined ? (
          <ValuePlaceholder className="rdx-switch" />
        ) : (
          <Switch
            id={id}
            checked={checked}
            disabled={disabled}
            aria-describedby={subtitle ? `${id}-subtitle` : undefined}
            onChange={(event) => onChange(event.target.checked)}
          />
        )}
      </label>
    </li>
  )
}

/**
 * Where a switch or a radio button goes while its value is still being read: as
 * large, but invisible. The control then appears already in its place, instead of
 * starting from a default and sliding to the stored value.
 */
const ValuePlaceholder = ({ className }: { className: string }) => (
  <span className={`${className} rdx-value-pending`} aria-hidden="true" />
)

/** One choice of a radio group: put them in a `SettingsSection`. */
export const RadioRow = ({
  name,
  value,
  title,
  subtitle,
  checked,
  onSelect,
  icon,
}: {
  name: string
  value: string
  title: string
  subtitle?: string
  icon?: ReactNode
  /** `undefined` while not known yet (still being read). */
  checked: boolean | undefined
  onSelect: (value: string) => void
}) => {
  const id = useId()
  return (
    <li>
      <label className="rdx-row" htmlFor={id}>
        <RowText
          title={title}
          subtitle={subtitle}
          subtitleId={subtitle ? `${id}-subtitle` : undefined}
          icon={icon}
        />
        {checked === undefined ? (
          <ValuePlaceholder className="rdx-radio" />
        ) : (
          <input
            id={id}
            type="radio"
            className="rdx-radio"
            name={name}
            value={value}
            checked={checked}
            aria-describedby={subtitle ? `${id}-subtitle` : undefined}
            onChange={() => onSelect(value)}
          />
        )}
      </label>
    </li>
  )
}

/** A labelled text field in a row, with help or an error below it. */
export const TextFieldRow = ({
  label,
  help,
  error,
  ...input
}: {
  label: string
  help?: string
  error?: string
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'className'>) => {
  const id = useId()
  const message = error ?? help
  return (
    <li>
      <div className="rdx-field">
        <label className="rdx-field__label" htmlFor={id}>
          {label}
        </label>
        <input
          {...input}
          id={id}
          className="rdx-field__input"
          aria-invalid={error ? true : undefined}
          aria-describedby={message ? `${id}-help` : undefined}
        />
        {message && (
          <p
            id={`${id}-help`}
            className={`rdx-field__help${
              error ? ' rdx-field__help--error' : ''
            }`}
            role={error ? 'alert' : undefined}
          >
            {message}
          </p>
        )}
      </div>
    </li>
  )
}
