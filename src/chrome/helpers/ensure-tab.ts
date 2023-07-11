import { okAsync } from 'neverthrow'
import { getExtensionTabsByUrl } from './get-extension-tabs-by-url'
import { createTab } from './create-tab'

export const ensureTab = (url: string) =>
  getExtensionTabsByUrl(url).andThen((tabs) =>
    tabs.length > 0 && tabs[0].id
      ? okAsync(tabs[0])
      : createTab(url, { active: false }),
  )
