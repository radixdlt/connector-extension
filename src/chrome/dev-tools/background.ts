chrome.contextMenus.create({
  id: 'radix-dev-tools',
  title: 'Radix dev tools',
  contexts: ['all'],
})

chrome.contextMenus.onClicked.addListener(async () => {
  const devToolsUrl = chrome.runtime.getURL(
    'src/chrome/dev-tools/dev-tools.html'
  )
  const tabs = await chrome.tabs.query({})
  const devToolsTab = tabs.find((tab) => tab.url === devToolsUrl)

  if (devToolsTab?.id) {
    await chrome.tabs.update(devToolsTab.id, { active: true })
  } else {
    await chrome.tabs.create({
      url: devToolsUrl,
    })
  }
})
