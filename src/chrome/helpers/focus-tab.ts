import { ResultAsync, errAsync } from 'neverthrow'
import { getExtensionTabsByUrl } from './get-extension-tabs-by-url'

export const focusTabByUrl = (url: string) =>
  getExtensionTabsByUrl(url).andThen((tabs) =>
    tabs.length > 0 && tabs[0].id
      ? focusTabById(tabs[0].id)
      : errAsync('no tab found'),
  )

export const focusTabById = (tabId: number) =>
  ResultAsync.fromPromise(chrome.tabs.update(tabId, { active: true }), (e) => e)
