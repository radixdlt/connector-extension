import { getExtensionTabsByUrl } from 'chrome/helpers/get-extension-tabs-by-url'
import { config } from 'config'

chrome.contextMenus.create({
  id: 'radix-dev-tools',
  title: 'Radix dev tools',
  contexts: ['all'],
})

const openRadixDevToolsPage = async () => {
  const devToolsUrl = chrome.runtime.getURL(config.popup.pages.devTools)

  const result = await getExtensionTabsByUrl(config.popup.pages.devTools)

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

chrome.contextMenus.onClicked.addListener(async () => openRadixDevToolsPage())
