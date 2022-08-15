const getExtensionTabs = async () =>
  (await chrome.tabs.query({})).filter((tab) =>
    tab?.url?.includes(chrome.runtime.id)
  )

chrome.runtime.onMessage.addListener(
  async (message, sender: chrome.runtime.MessageSender, sendResponse) => {
    const extensionTabs = await getExtensionTabs()
    const isExtensionOpen = extensionTabs.length > 0

    if (!isExtensionOpen) {
      chrome.windows.create({
        url: chrome.runtime.getURL('index.html'),
        type: 'popup',
        width: 1,
        height: 1,
        top: 0,
        left: 0,
      })
    }

    sendResponse(true)
  }
)
