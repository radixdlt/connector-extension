type Values<T> = T[keyof T]

export const LedgerInstructionClass = {
  aa: 'aa',
  ab: 'ab',
  ac: 'ac',
} as const

export const LedgerErrorCode = {
  FailedToCreateTransport: 'FailedToCreateTransport',
  FailedToListLedgerDevices: 'FailedToListLedgerDevices',
  FailedToExchangeData: 'FailedToExchangeData',
  NoDevicesConnected: 'NoDevicesConnected',
  MultipleLedgerConnected: 'MultipleLedgerConnected',
  DeviceMismatch: 'DeviceMismatch',
  UnlockDevice: '5515',
  BadIns: '6e01',
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
  SignAuthSecp256k1: '71',
} as const

export type LedgerError = Values<typeof LedgerErrorCode>
export type LedgerInstructionCode = Values<typeof LedgerInstructionCode>
export type LedgerInstructionClass = Values<typeof LedgerInstructionClass>
