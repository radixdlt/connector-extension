import { describe, expect, it } from 'vitest'
import { SessionRouter } from './session-router'

describe('SessionRouter', () => {
  it('routes a session to its wallet while that wallet is linked', () => {
    const router = SessionRouter()
    router.refreshStore({ session1: 'walletA' })
    router.setLinkedWallets(['walletA', 'walletB'])

    expect(router.getWalletPublicKey('session1')).toBe('walletA')
    expect(router.getWalletPublicKey('unknown')).toBeUndefined()
    expect(router.getWalletPublicKey(undefined)).toBeUndefined()
  })

  it('routes a session whose wallet is no longer linked to no wallet in particular', () => {
    const router = SessionRouter()
    router.refreshStore({ session1: 'forgotten' })

    router.setLinkedWallets(['walletB'])

    // As without a session: its requests go to every linked wallet, not to none.
    expect(router.getWalletPublicKey('session1')).toBeUndefined()
  })

  it('trusts the stored session until the links are known', () => {
    const router = SessionRouter()
    router.refreshStore({ session1: 'walletA' })

    expect(router.getWalletPublicKey('session1')).toBe('walletA')
  })
})
