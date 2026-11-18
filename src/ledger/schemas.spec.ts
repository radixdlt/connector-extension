import { describe, expect, it } from 'vitest'
import { safeParse } from 'valibot'
import {
  AccountListMessage,
  LedgerRequestSchema,
  LedgerResponseSchema,
} from './schemas'

const ledgerDevice = { model: 'nanoS+', id: 'device-1', name: 'My Ledger' }
const signer = {
  curve: 'curve25519',
  derivationPath: 'm/44H/1022H/1H/525H/1460H/0H',
}

describe('ledger schemas', () => {
  it('accepts every kind of ledger request', () => {
    const requests = [
      { interactionId: '1', discriminator: 'getDeviceInfo' },
      {
        interactionId: '2',
        discriminator: 'derivePublicKeys',
        keysParameters: [signer],
        ledgerDevice,
      },
      {
        interactionId: '3',
        discriminator: 'signTransaction',
        signers: [signer],
        ledgerDevice,
        displayHash: true,
        compiledTransactionIntent: 'abcd',
        mode: 'summary',
      },
      {
        interactionId: '4',
        discriminator: 'signChallenge',
        signers: [signer],
        ledgerDevice,
        challenge: 'ff',
        origin: 'https://dapp.example.com',
        dAppDefinitionAddress: 'account_tdx_2_1',
      },
      {
        interactionId: '5',
        discriminator: 'signSubintentHash',
        signers: [signer],
        ledgerDevice,
        subintentHash: 'ee',
      },
      {
        interactionId: '6',
        discriminator: 'deriveAndDisplayAddress',
        keyParameters: signer,
        ledgerDevice,
      },
    ]
    for (const request of requests)
      expect(safeParse(LedgerRequestSchema, request).success).toBe(true)
  })

  it('rejects unknown kinds, curves, devices and modes', () => {
    for (const request of [
      { interactionId: '1', discriminator: 'formatDevice' },
      {
        interactionId: '2',
        discriminator: 'derivePublicKeys',
        keysParameters: [{ ...signer, curve: 'ed448' }],
        ledgerDevice,
      },
      {
        interactionId: '3',
        discriminator: 'derivePublicKeys',
        keysParameters: [signer],
        ledgerDevice: { ...ledgerDevice, model: 'nanoZ' },
      },
      {
        interactionId: '4',
        discriminator: 'signTransaction',
        signers: [signer],
        ledgerDevice,
        displayHash: true,
        compiledTransactionIntent: 'abcd',
        mode: 'loud',
      },
    ])
      expect(safeParse(LedgerRequestSchema, request).success).toBe(false)
  })

  it('accepts success and error responses, and drops unknown keys', () => {
    const success = safeParse(LedgerResponseSchema, {
      interactionId: '1',
      discriminator: 'getDeviceInfo',
      success: { model: 'nanoX', id: 'device-1' },
      extra: 'dropped',
    })
    expect(success.success && success.output).toEqual({
      interactionId: '1',
      discriminator: 'getDeviceInfo',
      success: { model: 'nanoX', id: 'device-1' },
    })
    expect(
      safeParse(LedgerResponseSchema, {
        interactionId: '2',
        discriminator: 'signChallenge',
        error: { code: 1, message: 'rejected' },
      }).success,
    ).toBe(true)
  })

  it('reads the account list a wallet shares', () => {
    expect(
      safeParse(AccountListMessage, {
        interactionId: '1',
        discriminator: 'accountList',
        accounts: [
          { address: 'account_tdx_2_1', label: 'Main', appearanceId: 3 },
        ],
      }).success,
    ).toBe(true)
  })
})
