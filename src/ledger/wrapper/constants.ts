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

  NothingReceived: '6982',
  BadCla: '6e00',
  BadIns: '6e01',
  BadP1P2: '6e02',
  BadLen: '6e03',
  UserCancelled: '6e04',

  BadBip32PathLen: '6e10',
  BadBip32PathDataLen: '6e11',
  BadBip32PathLeadWord: '6e12',
  BadBip32PathCoinType: '6e13',
  BadBip32PathNetworkId: '6e14',
  BadBip32PathEntity: '6e15',
  BadBip32PathKeyType: '6e16',
  BadBip32PathMustBeHardened: '6e17',

  BadSecp256k1PublicKeyLen: '6e21',
  BadSecp256k1PublicKeyType: '6e22',

  BadTxSignSequence: '6e31',
  BadTxSignLen: '6e32',
  BadTxSignInitialState: '6e33',
  BadTxSignStart: '6e34',
  BadTxSignType: '6e35',
  BadTxSignDigestState: '6e36',
  BadTxSignRequestedState: '6e37',

  BadTxSignDecoderErrorInvalidInput: '6e41',
  BadTxSignDecoderErrorInvalidLen: '6e42',
  BadTxSignDecoderErrorInvalidState: '6e43',
  BadTxSignDecoderErrorStackOverflow: '6e44',
  BadTxSignDecoderErrorStackUnderflow: '6e45',
  BadTxSignDecoderErrorUnknownType: '6e46',
  BadTxSignDecoderErrorUnknownParameterType: '6e47',
  BadTxSignDecoderErrorUnknownEnum: '6e48',

  BadTxSignUserRejected: '6e50',

  BadAuthSignSequence: '6e60',
  BadAuthSignRequest: '6e61',

  NotImplemented: '6eff',
  Unknown: '6d00',
  CxErrorCarry: '6f01',
  CxErrorLocked: '6f02',
  CxErrorUnlocked: '6f03',
  CxErrorNotLocked: '6f04',
  CxErrorNotUnlocked: '6f05',
  CxErrorInternalError: '6f06',
  CxErrorInvalidParameterSize: '6f07',
  CxErrorInvalidParameterValue: '6f08',
  CxErrorInvalidParameter: '6f09',
  CxErrorNotInvertible: '6f0a',
  CxErrorOverflow: '6f0b',
  CxErrorMemoryFull: '6f0c',
  CxErrorNoResidue: '6f0d',
  CxErrorEcInfinitePoint: '6f0e',
  CxErrorEcInvalidPoint: '6f0f',
  CxErrorEcInvalidCurve: '6f10',
  Panic: 'e000',
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

export type LedgerError = Values<typeof LedgerErrorCode>
export type LedgerInstructionCode = Values<typeof LedgerInstructionCode>
export type LedgerInstructionClass = Values<typeof LedgerInstructionClass>
