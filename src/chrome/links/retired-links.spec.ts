import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { config } from 'config'
import {
  activeRetiredLinks,
  forgetRetiredLink,
  pruneRetiredLinks,
  retireLink,
} from './retired-links'

const connection = {
  password: 'ab'.repeat(32),
  walletPublicKey: 'c'.repeat(64),
  walletName: 'Pixel',
  accounts: [],
}

describe('retired links', () => {
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

  it('keeps one notice per link, and forgets it once delivered', async () => {
    await retireLink(connection, 10)
    await retireLink(connection, 20)
    expect(stored.retiredLinks).toEqual([
      {
        password: connection.password,
        walletPublicKey: connection.walletPublicKey,
        walletName: 'Pixel',
        retiredAt: 20,
      },
    ])

    await forgetRetiredLink(connection.password)
    expect(stored.retiredLinks).toEqual([])
  })

  it('forgets the passwords of expired notices', async () => {
    const lifetime = config.links.removalNoticeLifetime
    stored.retiredLinks = [
      { ...connection, password: 'old', retiredAt: 0 },
      { ...connection, password: 'new', retiredAt: lifetime },
    ]

    expect(
      activeRetiredLinks(stored.retiredLinks, lifetime + 1).map(
        (l) => l.password,
      ),
    ).toEqual(['new'])
    await pruneRetiredLinks(lifetime + 1)
    expect(stored.retiredLinks.map((l: any) => l.password)).toEqual(['new'])
  })
})
