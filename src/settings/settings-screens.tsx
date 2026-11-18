import type { ComponentType } from 'react'
import { Route, Routes } from 'react-router-dom'
import { DiagnosticsSettings } from './screens/diagnostics-settings'
import { PendingRequestsSettings } from './screens/pending-requests-settings'
import { RadixConnectSettings } from './screens/radix-connect-settings'
import { showsRadixConnect, type ScreenProps } from './screens/screen'
import { SettingsHome } from './screens/settings-home'
import { ThemeSettings } from './screens/theme-settings'
import { WalletOrderSettings } from './screens/wallet-order-settings'

/**
 * The sub-pages of the settings, by path. A new screen: its component in
 * `screens/`, a row in the settings home that navigates to its path, and an entry
 * here.
 */
const subPages: {
  path: string
  Screen: ComponentType<ScreenProps>
  available?: () => boolean
}[] = [
  { path: 'theme', Screen: ThemeSettings },
  { path: 'wallet-order', Screen: WalletOrderSettings },
  { path: 'pending-requests', Screen: PendingRequestsSettings },
  {
    path: 'radix-connect',
    Screen: RadixConnectSettings,
    available: showsRadixConnect,
  },
  {
    path: 'diagnostics',
    Screen: DiagnosticsSettings,
    available: showsRadixConnect,
  },
]

/**
 * The settings screens, relative to where they are mounted (`/settings/*` in the
 * popup and the side panel, `/` on the options page): the list, then its sub-pages.
 * `onExit`: back from the list (none on the options page).
 */
export const SettingsRoutes = ({
  onExit,
  page,
}: {
  onExit?: () => void
  page?: boolean
}) => {
  const home = <SettingsHome onExit={onExit} page={page} />
  return (
    <Routes>
      <Route index element={home} />
      {subPages
        .filter(({ available = () => true }) => available())
        .map(({ path, Screen }) => (
          <Route key={path} path={path} element={<Screen page={page} />} />
        ))}
      <Route path="*" element={home} />
    </Routes>
  )
}
