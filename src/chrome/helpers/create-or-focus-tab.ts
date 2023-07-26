import { getExtensionTabsByUrl } from './get-extension-tabs-by-url'
import { createTab } from './create-tab'
import { focusTabById } from './focus-tab'

export const createOrFocusTab = (url: string) =>
  getExtensionTabsByUrl(url).andThen((tabs) =>
    tabs.length > 0 && tabs[0].id ? focusTabById(tabs[0].id) : createTab(url),
  )
