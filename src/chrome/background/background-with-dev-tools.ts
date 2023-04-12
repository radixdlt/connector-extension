import './background'
import { getExtensionTabsByUrl } from 'chrome/helpers/get-extension-tabs-by-url'
import { config } from 'config'

const openRadixDevToolsPage = async () => {
  const devToolsUrl = chrome.runtime.getURL(config.devTools.url)

  const result = await getExtensionTabsByUrl(config.devTools.url)

  if (result.isErr()) return

  const [devToolsTab] = result.value

  if (devToolsTab?.id) {
    await chrome.tabs.update(devToolsTab.id, { active: true })
  } else {
    await chrome.tabs.create({
      url: devToolsUrl,
    })
  }
}

chrome.contextMenus.removeAll(() => {
  chrome.contextMenus.create({
    id: 'radix-dev-tools',
    title: 'Radix Dev Tools',
    contexts: ['all'],
  })

  chrome.contextMenus.onClicked.addListener(async () => openRadixDevToolsPage())
})
