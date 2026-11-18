import { lazy, Suspense } from 'react'
import { HashRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { PopupWindow } from 'components'
import { SurfaceContext, type Surface } from 'side-panel/surface'
import 'ui/tokens.css'
import { ConnectionStatus } from './components/connection-status'
import { SettingsButton } from './components/settings-button'
import {
  WalletPictureScreen,
  walletPicturePath,
} from './components/wallet-picture'
import './components/main-view.css'

// Loaded when first opened: the main view, shown first, needs neither the
// pairing's transports and crypto nor the settings screens.
const Pairing = lazy(() =>
  import('./pairing').then((module) => ({ default: module.Pairing })),
)
const SettingsRoutes = lazy(() =>
  import('settings/settings-screens').then((module) => ({
    default: module.SettingsRoutes,
  })),
)

/** The linked wallets and the pairing, on the brand gradient, with the gear. */
const MainShell = () => {
  const navigate = useNavigate()
  return (
    <PopupWindow style={{ padding: 16 }}>
      <SettingsButton onClick={() => navigate('/settings')} />
      <Suspense fallback={null}>
        <Routes>
          <Route index element={<ConnectionStatus />} />
          <Route path="pairing" element={<Pairing />} />
        </Routes>
      </Suspense>
    </PopupWindow>
  )
}

/** The settings, full size, back to the main view from their first screen. */
const SettingsShell = () => {
  const navigate = useNavigate()
  return (
    <Suspense fallback={null}>
      <SettingsRoutes onExit={() => navigate('/')} />
    </Suspense>
  )
}

/** The views, inside a router. */
export const AppRoutes = () => (
  <Routes>
    <Route path="/settings/*" element={<SettingsShell />} />
    <Route
      path={walletPicturePath}
      element={
        <PopupWindow style={{ padding: 16 }}>
          <WalletPictureScreen />
        </PopupWindow>
      }
    />
    <Route path="*" element={<MainShell />} />
  </Routes>
)

/** The app of the action popup and of the side panel. */
export const App = ({ surface }: { surface: Surface }) => (
  <SurfaceContext.Provider value={surface}>
    <HashRouter>
      <AppRoutes />
    </HashRouter>
  </SurfaceContext.Provider>
)
