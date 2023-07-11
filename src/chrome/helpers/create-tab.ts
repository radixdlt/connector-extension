import { ResultAsync } from 'neverthrow'

export const createTab = (url: string) =>
  ResultAsync.fromSafePromise(
    new Promise<chrome.tabs.Tab>((resolve) => {
      chrome.tabs.create({ url }, async (tab) => {
        const listener = (tabId: number, info: chrome.tabs.TabChangeInfo) => {
          if (info.status === 'complete' && tabId === tab.id) {
            chrome.tabs.onUpdated.removeListener(listener)
            resolve(tab)
          }
        }
        chrome.tabs.onUpdated.addListener(listener)
      })
    }),
  )
