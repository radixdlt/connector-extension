import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { RadioRow, SettingsPage } from '../settings-ui'
import type { ScreenProps } from './screen'

/** A screen under the settings, with its way back to them. */
export const SettingsSubPage = ({
  title,
  page,
  children,
}: ScreenProps & { title: string; children: ReactNode }) => {
  const navigate = useNavigate()
  return (
    <SettingsPage
      title={title}
      onBack={() => navigate('..')}
      backLabel="Back to the settings"
      page={page}
    >
      {children}
    </SettingsPage>
  )
}

/** One of the values a setting may take, as its row shows it. */
export type Choice = { title: string; subtitle: string; icon?: JSX.Element }

/**
 * A row for each of a setting's `choices`, the one of `value` checked; none while the
 * setting is not `loaded` yet. `icon`: for the choices without their own.
 */
export const ChoiceRows = <Value extends string>({
  name,
  choices,
  value,
  loaded,
  icon,
  onSelect,
}: {
  name: string
  choices: Record<Value, Choice>
  value: Value | undefined
  loaded: boolean
  icon?: JSX.Element
  onSelect: (value: Value) => void
}) => (
  <>
    {(Object.entries(choices) as [Value, Choice][]).map(
      ([choiceValue, choice]) => (
        <RadioRow
          key={choiceValue}
          name={name}
          value={choiceValue}
          icon={choice.icon ?? icon}
          title={choice.title}
          subtitle={choice.subtitle}
          checked={loaded ? value === choiceValue : undefined}
          onSelect={(selected) => onSelect(selected as Value)}
        />
      ),
    )}
  </>
)
