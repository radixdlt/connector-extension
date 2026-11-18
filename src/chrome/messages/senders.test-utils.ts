/** Senders of runtime messages, as Chrome gives them, for tests. */

/** One of the extension's own pages, e.g. the offscreen document. */
export const extensionPageSender = (): chrome.runtime.MessageSender => ({
  id: chrome.runtime.id,
  url: chrome.runtime.getURL('src/chrome/offscreen/index.html'),
})

/** The content script in a web page's tab. */
export const webPageSender = (tabId: number): chrome.runtime.MessageSender => ({
  id: chrome.runtime.id,
  url: 'https://dapp.example.com/',
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- test fake: only the tab id matters
  tab: { id: tabId } as chrome.tabs.Tab,
})
