import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getExtensionOptions, updateExtensionOptions } from 'options'

describe('extension options', () => {
  let stored: Record<string, any>

  beforeEach(() => {
    stored = {}
    vi.mocked(chrome.storage.local.get).mockImplementation(((key: string) =>
      Promise.resolve({ [key]: stored[key] })) as any)
    vi.mocked(chrome.storage.local.set).mockImplementation(((
      items: Record<string, unknown>,
    ) => {
      Object.assign(stored, items)
      return Promise.resolve()
    }) as any)
  })

  afterEach(() => {
    vi.mocked(chrome.storage.local.get).mockReset()
    vi.mocked(chrome.storage.local.set).mockReset()
  })

  it('draws the key pair once, saves it, then always reads the same', async () => {
    const first = (await getExtensionOptions())._unsafeUnwrap()

    expect(first.privateKey).toMatch(/^[0-9a-f]{64}$/)
    expect(first.publicKey).toMatch(/^[0-9a-f]{64}$/)
    expect(stored.options.privateKey).toBe(first.privateKey)
    const second = (await getExtensionOptions())._unsafeUnwrap()
    expect(second.privateKey).toBe(first.privateKey)
  })

  it('keeps a saved key pair, and gives missing options their defaults', async () => {
    stored.options = { publicKey: 'pub', privateKey: 'priv' }

    const options = (await getExtensionOptions())._unsafeUnwrap()

    expect(options).toMatchObject({
      publicKey: 'pub',
      privateKey: 'priv',
      showDAppRequestNotifications: true,
    })
  })

  it('saves only the changes, on top of what is saved', async () => {
    stored.options = {
      publicKey: 'pub',
      privateKey: 'priv',
      radixConnectTransport: 'iroh',
    }

    await updateExtensionOptions({ showDAppRequestNotifications: false })

    expect(stored.options).toMatchObject({
      publicKey: 'pub',
      privateKey: 'priv',
      radixConnectTransport: 'iroh',
      showDAppRequestNotifications: false,
    })
  })
})
