import { GearIcon } from 'ui/icons'

/** Top-right button of the popup and side panel opening the settings. */
export const SettingsButton = ({ onClick }: { onClick: () => void }) => (
  <button
    type="button"
    className="popup-icon-button settings-button"
    aria-label="Settings"
    title="Settings"
    onClick={onClick}
  >
    <GearIcon />
  </button>
)
