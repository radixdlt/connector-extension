import { parseAddress } from './parse-address'
import { describe, it, expect } from 'vitest'

describe('parse address', () => {
  const tests: [string, { networkId: number; type: string }][] = [
    [
      'account_tdx_2_129449mktvws4ww6wyww0dt85fn7md383cdq58307ayfz7g0n9vznfa',
      { networkId: 2, type: 'account' },
    ],
    [
      'account_tdx_2_128ex28rgvj4nqsqs7vtha0upknrpspzanfr95t6j6nss225dc47nu4',
      { networkId: 2, type: 'account' },
    ],
    [
      'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd',
      {
        networkId: 1,
        type: 'resource',
      },
    ],
    [
      'account_rdx12xezaw0gn9yhld6kplkk3ah7h6y48qgrmjr5e76krxq9hgws4junpr',
      {
        networkId: 1,
        type: 'account',
      },
    ],
    [
      'account_tdx_21_128wkep7c2mtdv5d0vvj23kp0rreud09384gru64w992pkmqga0nr87',
      {
        type: 'account',
        networkId: 21,
      },
    ],
    [
      'account_sim1cyyavav59dl55jur4eyxqz9wqyjycp2aua9dzduflfeefrfl623wgc',
      {
        networkId: 242,
        type: 'account',
      },
    ],
  ]
  it('should parse address', () => {
    tests.forEach(([address, expected]) => {
      expect(parseAddress(address)).toEqual(expected)
    })
  })

  it('should throw error on invalid address', () => {
    expect(() => parseAddress('invalid')).toThrowError(
      'Invalid address invalid',
    )
  })
})
