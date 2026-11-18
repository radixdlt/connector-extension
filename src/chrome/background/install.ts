import { config } from 'config'
// @ts-ignore
import content from '../content-script/content-script?script'
import { getExtensionOptions, setConnectorExtensionOptions } from 'options'
import type { AppLogger } from 'utils/logger'

/**
 * Installed or updated: the content script goes into the tabs already open (Chrome
 * only injects it into those loaded after), and the options are written with their
 * defaults.
 */
export const onInstallExtension =
  (logger: AppLogger) => async (details?: chrome.runtime.InstalledDetails) => {
    logger.info('extension installed or updated', {
      reason: details?.reason,
      previousVersion: details?.previousVersion,
      version: config.version,
    })
    for (const tab of await chrome.tabs.query({})) {
      try {
        if (tab.id) {
          await chrome.scripting.executeScript({
            target: {
              tabId: tab.id,
            },
            files: [content],
          })
        }
      } catch (err) {}
    }

    getExtensionOptions()
      .andThen(setConnectorExtensionOptions)
      .mapErr(() => logger.error('Failed to set extension options'))
  }
