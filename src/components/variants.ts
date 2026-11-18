import './base.css'
import './primitives.css'

/** The design scale of margins (`none` is 2px). */
export type Space =
  | 'none'
  | 'xs'
  | 'sm'
  | 'md'
  | 'lg'
  | 'xl'
  | '2xl'
  | '3xl'
  | '4xl'
  | '5xl'

export type MarginProps = {
  m?: Space
  mt?: Space
  mb?: Space
  ml?: Space
  mr?: Space
}

type Modifier = string | boolean | undefined

/**
 * The modifier classes of `block`: `block--name` for `true`, `block--name-value`
 * for a value, none for `false` or `undefined`.
 */
export const modifiers = (block: string, values: Record<string, Modifier>) =>
  Object.entries(values)
    .map(([name, value]) =>
      value === true || value === 'true'
        ? `${block}--${name}`
        : value
        ? `${block}--${name}-${value}`
        : undefined,
    )
    .filter(Boolean)
    .join(' ')

/** Splits the margin props off `props`, as classes. */
export const withMargins = <P extends MarginProps>(props: P) => {
  const { m, mt, mb, ml, mr, ...rest } = props
  return [modifiers('rdx-space', { m, mt, mb, ml, mr }), rest] as const
}

export const classNames = (...names: (string | undefined)[]) =>
  names.filter(Boolean).join(' ')
