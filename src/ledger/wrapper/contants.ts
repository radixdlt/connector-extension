type Values<T> = T[keyof T]

export const LedgerInstructionClass = {
  aa: 'aa',
  ab: 'ab',
  ac: 'ac',
} as const

export const LedgerErrorResponse = {
  FailedToCreateTransport: 'FailedToCreateTransport',
  FailedToExchangeData: 'FailedToExchangeData',
  MultipleLedgerConnected: 'MultipleLedgerConnected',
  DeviceMismatch: 'DeviceMismatch',
  UnlockDevice: '5515',
  OpenRadixApp: '6e01',
} as const

export const LedgerInstructionCode = {
  GetDeviceModel: '11',
  GetDeviceId: '12',
  GetPubKeyEd25519: '21',
  GetPubKeySecp256k1: '31',
  SignTxEd255519: '41',
  SignTxEd255519Smart: '42',
  SignTxSecp256k1: '51',
  SignTxSecp256k1Smart: '52',
} as const

export type LedgerError = Values<typeof LedgerErrorResponse>
export type LedgerInstructionCode = Values<typeof LedgerInstructionCode>
export type LedgerInstructionClass = Values<typeof LedgerInstructionClass>

export const errorResponses: Record<LedgerError, string> = {
  [LedgerErrorResponse.MultipleLedgerConnected]:
    'Please connect only one ledger device',
  [LedgerErrorResponse.UnlockDevice]:
    'Please unlock Ledger Device and try again',
  [LedgerErrorResponse.OpenRadixApp]:
    'Please open Radix Babylon app in your Ledger device and try again',
  [LedgerErrorResponse.FailedToCreateTransport]:
    'Failed to open transport layer with Ledger device',
  [LedgerErrorResponse.FailedToExchangeData]:
    'Failed to exchange data with Ledger device',
  [LedgerErrorResponse.DeviceMismatch]: `Device doesn't match. Make sure you connected correct Ledger device`,
}
