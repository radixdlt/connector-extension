import type { PendingRequestExpiry } from 'chrome/offscreen/requests/pending-request'
import { ScheduleIcon } from 'ui/icons'
import { SettingsSection } from '../settings-ui'
import { useExtensionOptions } from '../use-extension-options'
import type { ScreenProps } from './screen'
import { ChoiceRows, SettingsSubPage, type Choice } from './sub-page'

export const pendingRequestExpiryChoices: Record<PendingRequestExpiry, Choice> =
  {
    '2m': { title: 'After 2 minutes', subtitle: 'The dApp hears it soon' },
    '5m': { title: 'After 5 minutes', subtitle: 'Recommended' },
    '15m': {
      title: 'After 15 minutes',
      subtitle: 'Time to open or reconnect a wallet',
    },
    never: { title: 'Never', subtitle: 'They wait until you cancel them' },
  }

export const PendingRequestsSettings = ({ page }: ScreenProps) => {
  const { options, loaded, update } = useExtensionOptions()

  return (
    <SettingsSubPage title="Unanswered requests" page={page}>
      <SettingsSection
        title="Cancel a request no wallet is answering"
        radioGroup
        description="Only a request no wallet has received, or one a wallet lost when its app was closed. A request in your wallet is never cancelled: you may be approving it. The dApp is told."
      >
        <ChoiceRows
          name="pendingRequestExpiry"
          choices={pendingRequestExpiryChoices}
          value={options.pendingRequestExpiry}
          loaded={loaded}
          icon={<ScheduleIcon />}
          onSelect={(pendingRequestExpiry) => update({ pendingRequestExpiry })}
        />
      </SettingsSection>
    </SettingsSubPage>
  )
}
