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
  WrongDataLength: '6a87',

  // Error code sent to wallet
  Generic: 0,
  BlindSigningNotEnabledButRequired: 1,
  UserRejectedSigningOfTransaction: 2,
} as const

export const LedgerInstructionCode = {
  GetDeviceModel: '11',
  GetDeviceId: '12',
  GetAppSettingsId: '20',
  GetPubKeyEd25519: '21',
  GetPubKeySecp256k1: '31',
  SignTxEd25519: '41',
  SignTxSecp256k1: '51',
  SignAuthEd25519: '61',
  SignAuthSecp256k1: '71',
  DeriveAndDisplayAddressEd25519: '81',
  DeriveAndDisplayAddressSecp256k1: '91',
} as const

export type LedgerError = Values<typeof LedgerErrorCode>
export type LedgerInstructionCode = Values<typeof LedgerInstructionCode>
export type LedgerInstructionClass = Values<typeof LedgerInstructionClass>
