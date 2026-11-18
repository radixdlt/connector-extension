import { ConnectionDiagnostics } from 'options/connection-diagnostics'
import { useShowAdvancedDiagnostics } from 'options/advanced-diagnostics'
import { SettingsSection, SwitchRow } from '../settings-ui'
import type { ScreenProps } from './screen'
import { SettingsSubPage } from './sub-page'

export const DiagnosticsSettings = ({ page }: ScreenProps) => {
  const [showAdvanced, setShowAdvanced] = useShowAdvancedDiagnostics()

  return (
    <SettingsSubPage title="Connection diagnostics" page={page}>
      <SettingsSection title="Display">
        <SwitchRow
          title="Show advanced diagnostics"
          subtitle="Every detail of each link, for troubleshooting"
          checked={showAdvanced}
          onChange={setShowAdvanced}
        />
      </SettingsSection>
      <ConnectionDiagnostics advanced={showAdvanced ?? false} />
    </SettingsSubPage>
  )
}
