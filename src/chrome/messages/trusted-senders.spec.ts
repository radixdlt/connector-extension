import { describe, expect, it } from 'vitest'
import { isAllowedFrom, isExtensionPage } from './trusted-senders'
import { createMessage } from './create-message'

const origin = 'chrome-extension://abc/'
const page = { id: chrome.runtime.id, url: `${origin}src/options/index.html` }
const offscreen = {
  id: chrome.runtime.id,
  url: `${origin}src/chrome/offscreen/index.html`,
}
// A content script: the extension's id, but the URL of the web page it runs in.
const contentScript = {
  id: chrome.runtime.id,
  url: 'https://dapp.example.com/',
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- test fake: only the tab id matters
  tab: { id: 3 } as chrome.tabs.Tab,
}

describe('trusted senders', () => {
  it("tells the extension's pages from web pages, tab or not", () => {
    expect(isExtensionPage(offscreen, origin)).toBe(true)
    // The options page in a tab is still the extension's own page.
    expect(
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- test fake: only the tab id matters
      isExtensionPage({ ...page, tab: { id: 1 } as chrome.tabs.Tab }, origin),
    ).toBe(true)
    expect(isExtensionPage(contentScript, origin)).toBe(false)
    // Another extension's page, even at a URL like ours.
    expect(
      isExtensionPage({ id: 'another-extension', url: `${origin}x` }, origin),
    ).toBe(false)
  })

  it('lets a content script send dApp requests, confirmations and logs only', () => {
    const allowed = [
      createMessage.dAppRequest('contentScript', {} as any),
      createMessage.cancelWalletInteraction({} as any),
      createMessage.confirmationSuccess('contentScript', 'id'),
    ]
    for (const message of allowed)
      expect(isAllowedFrom(message, contentScript, origin)).toBe(true)

    const refused = [
      createMessage.walletToExtension(
        'offScreen',
        { discriminator: 'linkRemoved' },
        'a'.repeat(64),
      ),
      createMessage.setConnections('contentScript', {}),
      createMessage.cancelPendingRequest('id'),
    ]
    for (const message of refused) {
      expect(isAllowedFrom(message, contentScript, origin)).toBe(false)
      expect(isAllowedFrom(message, offscreen, origin)).toBe(true)
    }
  })
})
