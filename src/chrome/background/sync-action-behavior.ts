import type { ResultAsync } from 'neverthrow'
import type { AppLogger } from 'utils/logger'
import { reapplyActionBehavior } from 'side-panel/action-behavior'

type RuntimeEvent = { addListener: (callback: () => void) => void }

/**
 * Applies the saved extension icon behavior (popup or side panel) again when the
 * browser starts and when the extension is installed or updated: Chrome resets the
 * popup set at runtime then. The service worker keeps nothing in memory: the choice
 * is read from storage each time.
 */
export const syncActionBehavior = ({
  onStartup = chrome.runtime.onStartup,
  onInstalled = chrome.runtime.onInstalled,
  reapply = reapplyActionBehavior,
  logger,
}: {
  onStartup?: RuntimeEvent
  onInstalled?: RuntimeEvent
  reapply?: () => ResultAsync<boolean, Error>
  logger?: AppLogger
} = {}) => {
  const apply = (reason: string) =>
    reapply().match(
      (openSidePanel) =>
        logger?.info('extension icon behavior applied', {
          reason,
          opens: openSidePanel ? 'side panel' : 'popup',
        }),
      (error) =>
        logger?.warn('could not apply the extension icon behavior', {
          reason,
          message: error.message,
        }),
    )
  onStartup.addListener(() => apply('browser started'))
  onInstalled.addListener(() => apply('installed or updated'))
}
