export const getTabId = async () =>
  new Promise<number>((resolve) => {
    chrome.runtime.sendMessage({ type: 'getTabId' }, resolve)
  })
