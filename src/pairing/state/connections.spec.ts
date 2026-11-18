import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ConnectionsClient, type Connections } from './connections'

const connection = {
  walletName: 'Radix Wallet 1',
  password: 'ab'.repeat(32),
  walletPublicKey: 'wallet',
  accounts: [],
}

describe('ConnectionsClient.updateWalletRelay', () => {
  beforeEach(() => {
    vi.mocked(chrome.storage.local.set).mockReset()
    vi.mocked(chrome.storage.local.set).mockImplementation((() =>
      Promise.resolve()) as any)
  })

  it('keeps the relay the wallet was seen on with its link', async () => {
    const connections: Connections = { wallet: connection }

    await ConnectionsClient(connections).updateWalletRelay(
      'wallet',
      'https://use1-1.relay.n0.iroh-canary.iroh.link./',
    )

    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      connections: {
        wallet: {
          ...connection,
          walletRelay: 'https://use1-1.relay.n0.iroh-canary.iroh.link./',
        },
      },
    })
  })

  it('does not bring back a link that is gone, nor store an unchanged relay', () => {
    const connections: Connections = {
      wallet: { ...connection, walletRelay: 'https://relay.example.com/' },
    }
    const client = ConnectionsClient(connections)

    expect(client.updateWalletRelay('gone', 'https://relay.example.com/')).toBe(
      undefined,
    )
    expect(
      client.updateWalletRelay('wallet', 'https://relay.example.com/'),
    ).toBe(undefined)
    expect(chrome.storage.local.set).not.toHaveBeenCalled()
  })
})
