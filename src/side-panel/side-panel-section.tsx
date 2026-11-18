import { useStoredFlag } from 'chrome/helpers/use-local-store'
import { useEffect, useState } from 'react'
import { SettingsRow, SettingsSection, SwitchRow } from 'settings/settings-ui'
import { LaunchIcon, OpenInPanelIcon } from 'ui/icons'
import {
  getCurrentWindowId,
  isSidePanelAvailable,
  openSidePanel,
  openSidePanelOnActionClickKey,
  setOpenSidePanelOnActionClick,
} from './action-behavior'
import { useSurface } from './surface'

/**
 * Settings to use the extension as a side panel: whether the extension icon opens
 * it instead of the popup, and opening it now (not offered inside the side panel).
 * Nothing without the side panel API.
 */
export const SidePanelSection = () => {
  const surface = useSurface()
  const available = isSidePanelAvailable()
  // Unknown (undefined) until read, the first time in this page.
  const [openOnActionClick, setOpenOnActionClick] = useStoredFlag(
    openSidePanelOnActionClickKey,
    available,
  )
  const [saving, setSaving] = useState(false)
  const [windowId, setWindowId] = useState<number>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (!available) return
    let active = true
    // Known before any click: opening the side panel must not wait for it.
    getCurrentWindowId().map((id) => {
      if (active) setWindowId(id)
    })
    return () => {
      active = false
    }
  }, [available])

  if (!available) return null

  const changeActionBehavior = (next: boolean) => {
    setError(undefined)
    setSaving(true)
    setOpenOnActionClick(next)
    setOpenSidePanelOnActionClick(next).match(
      () => setSaving(false),
      (failure) => {
        setOpenOnActionClick(!next)
        setSaving(false)
        setError(`Could not change it: ${failure.message}`)
      },
    )
  }

  const openInSidePanel = () => {
    setError(undefined)
    // Called right away: the click's user gesture is needed.
    openSidePanel(windowId).match(
      () => {
        if (surface === 'popup') window.close()
      },
      (failure) =>
        setError(`Could not open the side panel: ${failure.message}`),
    )
  }

  return (
    <div data-testid="side-panel-settings">
      <SettingsSection
        title="Side panel"
        footer={error && <span role="alert">{error}</span>}
      >
        <SwitchRow
          icon={<OpenInPanelIcon />}
          title="Open as a side panel when clicking the extension icon"
          subtitle="Instead of the popup"
          checked={openOnActionClick}
          disabled={saving}
          onChange={changeActionBehavior}
        />
        {surface !== 'sidePanel' && (
          <SettingsRow
            icon={<LaunchIcon />}
            title="Open in side panel"
            subtitle="Keep the connector open next to the dApp"
            onClick={openInSidePanel}
          />
        )}
      </SettingsSection>
    </div>
  )
}
