type Values<T> = T[keyof T]

export const LedgerInstructionClass = {
  aa: 'aa',
  ab: 'ab',
  ac: 'ac',
} as const

export const LedgerErrorResponse = {
  FailedToCreateTransport: 'FailedToCreateTransport',
  FailedToListLedgerDevices: 'FailedToListLedgerDevices',
  FailedToExchangeData: 'FailedToExchangeData',
  NoDevicesConnected: 'NoDevicesConnected',
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
  SignAuthEd25519: '61',
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
  [LedgerErrorResponse.NoDevicesConnected]:
    'Did not find any connected Ledger devices. Please connect your Ledger device and try again',
  [LedgerErrorResponse.FailedToListLedgerDevices]:
    'Failed initial check to check list of connected devices',
  [LedgerErrorResponse.FailedToCreateTransport]:
    'Could not recognize Ledger device. Did you connect it to your computer and unlock it?',
  [LedgerErrorResponse.FailedToExchangeData]:
    'Failed to exchange data with Ledger device. Did you disconnect it?',
  [LedgerErrorResponse.DeviceMismatch]: `Connected device doesn't match requested one. Make sure you connected correct Ledger device`,
}
