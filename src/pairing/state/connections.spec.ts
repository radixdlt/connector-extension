import { describe, expect, it } from 'vitest'
import { linkedConnection } from './connections'

const known = {
  walletName: 'My phone',
  walletPublicKey: 'ab'.repeat(32),
  password: 'old',
  accounts: [],
  walletRelay: 'https://euc1-1.relay.n0.iroh.link./',
}

describe('linkedConnection', () => {
  it('names a new wallet after the ones linked before', () => {
    expect(
      linkedConnection({
        walletPublicKey: 'cd'.repeat(32),
        password: 'new',
        knownConnection: undefined,
        numberOfExistingConnections: 2,
      }),
    ).toEqual({
      walletName: 'Radix Wallet 3',
      walletPublicKey: 'cd'.repeat(32),
      password: 'new',
      accounts: [],
    })
  })

  it('keeps the name, accounts and relay of a wallet linked again, with its new password', () => {
    expect(
      linkedConnection({
        walletPublicKey: known.walletPublicKey,
        password: 'new',
        knownConnection: known,
        numberOfExistingConnections: 1,
      }),
    ).toEqual({ ...known, password: 'new' })
  })
})
