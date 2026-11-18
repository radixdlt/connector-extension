import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ConnectionsClient } from './connections'
import {
  forgetWalletRecords,
  recordWalletLinked,
  recordWalletUsed,
  setWalletPicture,
} from './wallet-records'

describe('wallet records', () => {
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

  it('keeps when a wallet was linked and last used', async () => {
    await recordWalletLinked('a', 100)
    await recordWalletUsed('a', 200)
    await recordWalletUsed('b', 300)

    expect(stored.walletActivity).toEqual({
      a: { linkedAt: 100, lastUsedAt: 200 },
      b: { lastUsedAt: 300 },
    })
  })

  it('sets and removes a picture', async () => {
    await setWalletPicture('a', 'data:image/webp;base64,AAAA')
    expect(stored.walletPictures).toEqual({ a: 'data:image/webp;base64,AAAA' })

    await setWalletPicture('a', undefined)
    expect(stored.walletPictures).toEqual({})
  })

  it('keeps nothing of a forgotten wallet', async () => {
    stored.walletActivity = { a: { linkedAt: 1 }, b: { linkedAt: 2 } }
    stored.walletPictures = { a: 'picture', b: 'other' }
    stored.walletOrder = ['b', 'a']

    await forgetWalletRecords('a')

    expect(stored.walletActivity).toEqual({ b: { linkedAt: 2 } })
    expect(stored.walletPictures).toEqual({ b: 'other' })
    expect(stored.walletOrder).toEqual(['b'])
  })
})

describe('forgetting a linked wallet', () => {
  let stored: Record<string, any>
  const pixel = {
    walletPublicKey: 'a'.repeat(64),
    walletName: 'Pixel',
    password: 'aa'.repeat(32),
    accounts: [],
    // Connected over iroh before: a wallet that knows linkRemoved.
    walletRelay: 'https://relay.example.com',
  }

  beforeEach(() => {
    stored = { connections: { [pixel.walletPublicKey]: pixel } }
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

  it('keeps a notice for the wallet when forgotten here', async () => {
    await ConnectionsClient(stored.connections).remove(pixel.walletPublicKey)
    await vi.waitFor(() =>
      expect(stored.retiredLinks?.[0]).toMatchObject({
        password: pixel.password,
        walletPublicKey: pixel.walletPublicKey,
        walletName: 'Pixel',
      }),
    )
    expect(stored.connections).toEqual({})
  })

  it('keeps none for a wallet that never connected over iroh', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- omits the key from the rest
    const { walletRelay: _relay, ...webRtcOnly } = pixel
    stored.connections = { [pixel.walletPublicKey]: webRtcOnly }
    await ConnectionsClient(stored.connections).remove(pixel.walletPublicKey)
    await new Promise((resolve) => {
      setTimeout(resolve, 20)
    })
    expect(stored.retiredLinks).toBeUndefined()
    expect(stored.connections).toEqual({})
  })

  it('keeps none when the wallet removed the link itself', async () => {
    await ConnectionsClient(stored.connections).remove(pixel.walletPublicKey, {
      tellWallet: false,
    })
    await new Promise((resolve) => {
      setTimeout(resolve, 20)
    })
    expect(stored.retiredLinks).toBeUndefined()
    expect(stored.connections).toEqual({})
  })
})
