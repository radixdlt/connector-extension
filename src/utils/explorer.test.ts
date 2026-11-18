import { describe, expect, it } from 'vitest'
import { accountExplorerUrl, transactionExplorerUrl } from './explorer'

describe('the explorer', () => {
  it('shows an account or a transaction of any network', () => {
    expect(accountExplorerUrl('account_tdx_2_1abc')).toBe(
      'https://radix-community.genkipool.com/dashboard/account/account_tdx_2_1abc',
    )
    expect(transactionExplorerUrl('txid_rdx1abc')).toBe(
      'https://radix-community.genkipool.com/dashboard/tx/txid_rdx1abc',
    )
  })
})
