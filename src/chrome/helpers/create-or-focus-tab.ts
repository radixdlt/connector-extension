import { ResultAsync } from 'neverthrow'
import { getExtensionTabsByUrl } from './get-extension-tabs-by-url'

export const createOrFocusTab = (url: string) =>
  getExtensionTabsByUrl(url).andThen((tabs) =>
    ResultAsync.fromSafePromise(
      tabs.length > 0 && tabs[0].id
        ? chrome.tabs.update(tabs[0].id, { active: true })
        : new Promise<chrome.tabs.Tab>((resolve) => {
            chrome.tabs.create({ url }, async (tab) => {
              const listener = (
                tabId: number,
                info: chrome.tabs.TabChangeInfo
              ) => {
                if (info.status === 'complete' && tabId === tab.id) {
                  chrome.tabs.onUpdated.removeListener(listener)
                  resolve(tab)
                }
              }
              chrome.tabs.onUpdated.addListener(listener)
            })
          })
    )
  )
