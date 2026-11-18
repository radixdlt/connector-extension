import { describe, expect, it } from 'vitest'
import { moveWallet, sortWallets } from './wallet-order'

const wallets: [string, { walletName: string }][] = [
  ['a', { walletName: 'pixel 8' }],
  ['b', { walletName: 'iPhone 15' }],
  ['c', { walletName: 'Pixel 10' }],
  ['d', { walletName: 'Android' }],
]
const ids = (sorted: [string, unknown][]) => sorted.map(([id]) => id)

describe('sortWallets', () => {
  it('keeps the custom order, then the wallets not in it as they were linked', () => {
    expect(
      ids(sortWallets(wallets, { sort: 'custom', order: ['c', 'a'] })),
    ).toEqual(['c', 'a', 'b', 'd'])
  })

  it('sorts by name, ignoring case and with numbers in order', () => {
    expect(ids(sortWallets(wallets, { sort: 'name' }))).toEqual([
      'd',
      'b',
      'a',
      'c',
    ])
  })

  it('puts the wallet linked last first, those without a time last', () => {
    const activity = { b: { linkedAt: 100 }, c: { linkedAt: 200 } }
    expect(
      ids(sortWallets(wallets, { sort: 'recentlyLinked', activity })),
    ).toEqual(['c', 'b', 'd', 'a'])
  })

  it('puts the wallet used last first, the unused ones in the custom order', () => {
    const activity = { d: { lastUsedAt: 50 }, b: { lastUsedAt: 90 } }
    expect(
      ids(
        sortWallets(wallets, {
          sort: 'recentlyUsed',
          activity,
          order: ['c', 'a'],
        }),
      ),
    ).toEqual(['b', 'd', 'c', 'a'])
  })

  it('puts the connected wallets first, each group in the custom order', () => {
    expect(
      ids(
        sortWallets(wallets, {
          sort: 'connected',
          order: ['d', 'c', 'b', 'a'],
          isConnected: (id) => id === 'a' || id === 'c',
        }),
      ),
    ).toEqual(['c', 'a', 'd', 'b'])
  })
})

describe('moveWallet', () => {
  it('moves a wallet up or down, within bounds', () => {
    expect(moveWallet(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b'])
    expect(moveWallet(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c'])
    expect(moveWallet(['a', 'b', 'c'], 0, 9)).toEqual(['b', 'c', 'a'])
  })
})
