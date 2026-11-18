import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { noteWalletRelay } from './wallet-relay'

const relay = 'https://euc1-1.relay.n0.iroh.link./'

describe('noteWalletRelay', () => {
  let stored: Record<string, any>

  beforeEach(() => {
    stored = {
      connections: {
        w1: {
          walletName: 'Pixel',
          walletPublicKey: 'w1',
          password: 'ab'.repeat(32),
          accounts: [],
        },
      },
    }
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

  it('keeps the relay with its link, and nothing else changes', async () => {
    await noteWalletRelay('w1', relay)
    expect(stored.connections.w1).toEqual({
      walletName: 'Pixel',
      walletPublicKey: 'w1',
      password: 'ab'.repeat(32),
      accounts: [],
      walletRelay: relay,
    })
  })

  it('never brings back a forgotten link', async () => {
    await noteWalletRelay('gone', relay)
    expect(Object.keys(stored.connections)).toEqual(['w1'])
  })
})
