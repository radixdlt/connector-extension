import {
  DarkModeIcon,
  GradientIcon,
  LightModeIcon,
  SystemModeIcon,
} from 'ui/icons'
import { useThemePreference, type ThemePreference } from 'ui/theme'
import { SettingsSection } from '../settings-ui'
import type { ScreenProps } from './screen'
import { ChoiceRows, SettingsSubPage, type Choice } from './sub-page'

export const themeChoices: Record<ThemePreference, Choice> = {
  classic: {
    title: 'Classic',
    subtitle: 'The original blue gradient of the connector',
    icon: <GradientIcon />,
  },
  system: {
    title: 'System',
    subtitle: 'Light or dark, as your system',
    icon: <SystemModeIcon />,
  },
  light: {
    title: 'Light',
    subtitle: 'The Radix Wallet’s light theme',
    icon: <LightModeIcon />,
  },
  dark: {
    title: 'Dark',
    subtitle: 'The Radix Wallet’s dark theme',
    icon: <DarkModeIcon />,
  },
}

export const ThemeSettings = ({ page }: ScreenProps) => {
  const [themePreference, setThemePreference] = useThemePreference()

  return (
    <SettingsSubPage title="Theme" page={page}>
      <SettingsSection
        title="Theme"
        radioGroup
        description="Applies to the popup, the side panel and this page."
      >
        <ChoiceRows
          name="theme"
          choices={themeChoices}
          value={themePreference}
          loaded
          onSelect={setThemePreference}
        />
      </SettingsSection>
    </SettingsSubPage>
  )
}
