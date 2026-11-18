import { extensionVersion } from 'utils/extension-version'
import { useNavigate } from 'react-router-dom'
import { useLocalStore } from 'chrome/helpers/use-local-store'
import { defaultWalletSort } from 'pairing/state/wallet-order'
import { walletSortChoices } from './wallet-order-settings'
import { config } from 'config'
import { transportLabels } from 'options/diagnostics-report'
import { SidePanelSection } from 'side-panel/side-panel-section'
import {
  BellIcon,
  BuildIcon,
  ImageIcon,
  InfoIcon,
  LinkIcon,
  PaletteIcon,
  PulseIcon,
  ReceiptIcon,
  ScheduleIcon,
  SortIcon,
} from 'ui/icons'
import { useThemePreference } from 'ui/theme'
import {
  SettingsPage,
  SettingsRow,
  SettingsSection,
  SwitchRow,
} from '../settings-ui'
import { useExtensionOptions } from '../use-extension-options'
import { showsRadixConnect, type ScreenProps } from './screen'
import { themeChoices } from './theme-settings'
import { pendingRequestExpiryChoices } from './pending-requests-settings'

export const SettingsHome = ({
  onExit,
  page,
}: ScreenProps & { onExit?: () => void }) => {
  const navigate = useNavigate()
  const { options, loaded, radixConnectTransport, update } =
    useExtensionOptions()
  const [themePreference] = useThemePreference()
  const [showWalletPictures, setShowWalletPictures] = useLocalStore(
    'showWalletPictures',
    true,
  )
  const [walletSort] = useLocalStore('walletSort', defaultWalletSort)

  return (
    <SettingsPage
      title="Settings"
      onBack={onExit}
      backLabel="Back to the wallet connector"
      page={page}
    >
      <SettingsSection title="Notifications">
        <SwitchRow
          icon={<BellIcon />}
          title="dApp requests"
          subtitle="A desktop notification for each request from a dApp"
          checked={loaded ? options.showDAppRequestNotifications : undefined}
          onChange={(checked) =>
            update({ showDAppRequestNotifications: checked })
          }
        />
        <SwitchRow
          icon={<ReceiptIcon />}
          title="Transaction results"
          subtitle="A desktop notification when a transaction succeeds or fails"
          checked={
            loaded ? options.showTransactionResultNotifications : undefined
          }
          onChange={(checked) =>
            update({ showTransactionResultNotifications: checked })
          }
        />
      </SettingsSection>
      <SettingsSection title="Requests">
        <SettingsRow
          icon={<ScheduleIcon />}
          title="Unanswered requests"
          subtitle={
            loaded
              ? `Cancelled: ${pendingRequestExpiryChoices[
                  options.pendingRequestExpiry
                ].title.toLowerCase()}`
              : undefined
          }
          onClick={() => navigate('pending-requests')}
          testId="pending-requests-row"
        />
      </SettingsSection>
      <SettingsSection title="Appearance">
        <SwitchRow
          icon={<ImageIcon />}
          title="Wallet pictures"
          subtitle="A picture on each wallet card: tap it to choose one"
          checked={showWalletPictures}
          onChange={setShowWalletPictures}
        />
        <SettingsRow
          icon={<PaletteIcon />}
          title="Theme"
          subtitle={themeChoices[themePreference].title}
          onClick={() => navigate('theme')}
          testId="theme-row"
        />
        <SettingsRow
          icon={<SortIcon />}
          title="Sort wallets"
          subtitle={
            walletSort === undefined
              ? undefined
              : walletSortChoices[walletSort].title
          }
          onClick={() => navigate('wallet-order')}
        />
      </SettingsSection>
      <SidePanelSection />
      {showsRadixConnect() && (
        <SettingsSection title="Connection">
          <SettingsRow
            icon={<LinkIcon />}
            title="Radix Connect"
            subtitle={`Transport: ${transportLabels[radixConnectTransport]}`}
            onClick={() => navigate('radix-connect')}
          />
          <SettingsRow
            icon={<PulseIcon />}
            title="Connection diagnostics"
            subtitle="How each linked wallet is connected"
            onClick={() => navigate('diagnostics')}
          />
        </SettingsSection>
      )}
      <SettingsSection title="About">
        <SettingsRow
          icon={<InfoIcon />}
          title="Version"
          value={extensionVersion()}
        />
        <SettingsRow
          icon={<BuildIcon />}
          title="Build"
          value={config.buildId}
        />
      </SettingsSection>
    </SettingsPage>
  )
}
