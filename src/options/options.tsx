import { HashRouter } from 'react-router-dom'
import { SettingsRoutes } from 'settings/settings-screens'
import { SurfaceContext } from 'side-panel/surface'

/**
 * The options page (chrome://extensions → Details → Extension options): the same
 * settings as the popup's, full page.
 */
export const Options = () => (
  <SurfaceContext.Provider value="page">
    <HashRouter>
      <SettingsRoutes page />
    </HashRouter>
  </SurfaceContext.Provider>
)
