import { ResultAsync } from 'neverthrow'
import { getExtensionTabsByUrl } from './get-extension-tabs-by-url'
import { createTab } from './create-tab'

export const createOrFocusTab = (url: string) =>
  getExtensionTabsByUrl(url).andThen((tabs) =>
    tabs.length > 0 && tabs[0].id
      ? ResultAsync.fromSafePromise(
          chrome.tabs.update(tabs[0].id, { active: true })
        )
      : createTab(url)
  )
