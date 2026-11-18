import {
  array,
  boolean,
  literal,
  number,
  object,
  optional,
  picklist,
  string,
  union,
  type InferOutput,
} from 'valibot'
import { LedgerErrorCode } from './wrapper/constants'

const curve = picklist(['curve25519', 'secp256k1'])

const ledgerDeviceModel = picklist(['nanoS', 'nanoS+', 'nanoX'])

const ledgerDiscriminator = picklist([
  'getDeviceInfo',
  'derivePublicKeys',
  'signTransaction',
  'signSubintentHash',
  'signChallenge',
  'deriveAndDisplayAddress',
])

export const LedgerDiscriminator: Record<
  InferOutput<typeof ledgerDiscriminator>,
  string
> = {
  getDeviceInfo: 'getDeviceInfo',
  derivePublicKeys: 'derivePublicKeys',
  signTransaction: 'signTransaction',
  signSubintentHash: 'signSubintentHash',
  signChallenge: 'signChallenge',
  deriveAndDisplayAddress: 'deriveAndDisplayAddress',
} as const

export const LedgerDeviceSchema = object({
  name: optional(string()),
  model: ledgerDeviceModel,
  id: string(),
})

export type LedgerDevice = InferOutput<typeof LedgerDeviceSchema>

export const KeyParametersSchema = object({
  curve,
  derivationPath: string(),
})

export type KeyParameters = InferOutput<typeof KeyParametersSchema>

export const LedgerDeviceIdRequestSchema = object({
  interactionId: string(),
  discriminator: literal('getDeviceInfo'),
})

export type LedgerDeviceIdRequest = InferOutput<
  typeof LedgerDeviceIdRequestSchema
>

export const LedgerDeriveAndDisplayAddressRequestSchema = object({
  interactionId: string(),
  discriminator: literal('deriveAndDisplayAddress'),
  keyParameters: KeyParametersSchema,
  ledgerDevice: LedgerDeviceSchema,
})

export type LedgerDeriveAndDisplayAddressRequest = InferOutput<
  typeof LedgerDeriveAndDisplayAddressRequestSchema
>

export const LedgerPublicKeyRequestSchema = object({
  interactionId: string(),
  discriminator: literal('derivePublicKeys'),
  keysParameters: array(KeyParametersSchema),
  ledgerDevice: LedgerDeviceSchema,
})

export type LedgerPublicKeyRequest = InferOutput<
  typeof LedgerPublicKeyRequestSchema
>

export const LedgerSignTransactionRequestSchema = object({
  interactionId: string(),
  discriminator: literal('signTransaction'),
  signers: array(KeyParametersSchema),
  ledgerDevice: LedgerDeviceSchema,
  displayHash: boolean(),
  compiledTransactionIntent: string(),
  mode: optional(picklist(['verbose', 'summary'])),
})

export type LedgerSignTransactionRequest = InferOutput<
  typeof LedgerSignTransactionRequestSchema
>

export const LedgerSignChallengeRequestSchema = object({
  interactionId: string(),
  discriminator: literal('signChallenge'),
  signers: array(KeyParametersSchema),
  ledgerDevice: LedgerDeviceSchema,
  challenge: string(),
  origin: string(),
  dAppDefinitionAddress: string(),
})

export type LedgerSignChallengeRequest = InferOutput<
  typeof LedgerSignChallengeRequestSchema
>

export const LedgerSignSubintentHashRequestSchema = object({
  interactionId: string(),
  discriminator: literal('signSubintentHash'),
  signers: array(KeyParametersSchema),
  ledgerDevice: LedgerDeviceSchema,
  subintentHash: string(),
})

export type LedgerSignSubintentHashRequest = InferOutput<
  typeof LedgerSignSubintentHashRequestSchema
>

export const LedgerRequestSchema = union([
  LedgerDeviceIdRequestSchema,
  LedgerPublicKeyRequestSchema,
  LedgerSignTransactionRequestSchema,
  LedgerSignSubintentHashRequestSchema,
  LedgerSignChallengeRequestSchema,
  LedgerDeriveAndDisplayAddressRequestSchema,
])

export type LedgerRequest = InferOutput<typeof LedgerRequestSchema>

export const LedgerDeviceIdResponseSchema = object({
  interactionId: string(),
  discriminator: literal('getDeviceInfo'),
  success: object({
    model: ledgerDeviceModel,
    id: string(),
  }),
})

export type LedgerDeviceIdResponse = InferOutput<
  typeof LedgerDeviceIdResponseSchema
>

export const DerivedPublicKeySchema = object({
  curve,
  publicKey: string(),
  derivationPath: string(),
})

export type DerivedPublicKey = InferOutput<typeof DerivedPublicKeySchema>

export const DerivedAddressSchema = object({
  derivedKey: DerivedPublicKeySchema,
  address: string(),
})

export type DerivedAddress = InferOutput<typeof DerivedAddressSchema>

export const SignatureOfSignerSchema = object({
  derivedPublicKey: DerivedPublicKeySchema,
  signature: string(),
})

export type AccountListMessage = InferOutput<typeof AccountListMessage>
export const AccountListMessage = object({
  interactionId: string(),
  discriminator: literal('accountList'),
  accounts: array(
    object({
      address: string(),
      label: string(),
      appearanceId: number(),
    }),
  ),
})

export type LinkClientInteraction = InferOutput<typeof LinkClientInteraction>
export const LinkClientInteraction = object({
  discriminator: literal('linkClient'),
  publicKey: string(),
  signature: optional(string()),
})

/**
 * A link was removed at one end (the wallet deleted the connector, or the extension
 * forgot the wallet): the other end forgets it too. Sent over the link itself,
 * which authenticates it, in both directions.
 */
export type LinkRemovedMessage = InferOutput<typeof LinkRemovedMessage>
export const LinkRemovedMessage = object({
  discriminator: literal('linkRemoved'),
})

export const linkRemovedMessage: LinkRemovedMessage = {
  discriminator: 'linkRemoved',
}

/** What a wallet sends to the extension itself, rather than to a dApp. */
export type WalletToExtensionMessage =
  | AccountListMessage
  | LinkClientInteraction
  | LinkRemovedMessage

export const isWalletToExtensionMessage = (
  message: unknown,
): message is WalletToExtensionMessage =>
  ['accountList', 'linkClient', 'linkRemoved'].includes(
    (message as { discriminator?: unknown } | undefined)
      ?.discriminator as string,
  )

export type SignatureOfSigner = InferOutput<typeof SignatureOfSignerSchema>

export const LedgerPublicKeyResponseSchema = object({
  interactionId: string(),
  discriminator: literal('derivePublicKeys'),
  success: array(DerivedPublicKeySchema),
})

export type LedgerPublicKeyResponse = InferOutput<
  typeof LedgerPublicKeyResponseSchema
>

export const LedgerSignTransactionResponseSchema = object({
  interactionId: string(),
  discriminator: literal('signTransaction'),
  success: array(SignatureOfSignerSchema),
})

export type LedgerSignTransactionResponse = InferOutput<
  typeof LedgerSignTransactionResponseSchema
>

export const LedgerDeriveAndDisplayAddressResponseSchema = object({
  interactionId: string(),
  discriminator: literal('deriveAndDisplayAddress'),
  success: DerivedAddressSchema,
})

export const LedgerSignChallengeResponseSchema = object({
  interactionId: string(),
  discriminator: literal('signChallenge'),
  success: array(SignatureOfSignerSchema),
})

export type LedgerSignChallengeResponse = InferOutput<
  typeof LedgerSignChallengeResponseSchema
>

export const LedgerErrorResponseSchema = object({
  interactionId: string(),
  discriminator: ledgerDiscriminator,
  error: object({
    code: number(),
    message: string(),
  }),
})

export const LedgerSignSubintentHashResponseSchema = object({
  interactionId: string(),
  discriminator: literal('signSubintentHash'),
  success: array(SignatureOfSignerSchema),
})

export type LedgerSignSubintentHashResponse = InferOutput<
  typeof LedgerSignSubintentHashResponseSchema
>

export const LedgerSuccessResponseSchema = union([
  LedgerDeviceIdResponseSchema,
  LedgerPublicKeyResponseSchema,
  LedgerSignTransactionResponseSchema,
  LedgerSignSubintentHashResponseSchema,
  LedgerSignChallengeResponseSchema,
  LedgerDeriveAndDisplayAddressResponseSchema,
])

export type LedgerSuccessResponse = InferOutput<
  typeof LedgerSuccessResponseSchema
>

export type LedgerErrorResponse = InferOutput<typeof LedgerErrorResponseSchema>

export const LedgerResponseSchema = union([
  LedgerSuccessResponseSchema,
  LedgerErrorResponseSchema,
])

export type LedgerResponse = InferOutput<typeof LedgerResponseSchema>

const ledgerRequestDiscriminators: ReadonlySet<unknown> = new Set<
  LedgerRequest['discriminator']
>([
  'getDeviceInfo',
  'derivePublicKeys',
  'signTransaction',
  'signChallenge',
  'signSubintentHash',
  'deriveAndDisplayAddress',
])

export const isLedgerRequest = (message: unknown): message is LedgerRequest =>
  ledgerRequestDiscriminators.has(
    (message as { discriminator?: unknown } | undefined)?.discriminator,
  )

export const isDeviceIdRequest = (
  message?: LedgerRequest,
): message is LedgerDeviceIdRequest =>
  message?.discriminator === 'getDeviceInfo'

export const isPublicKeyRequest = (
  message?: LedgerRequest,
): message is LedgerPublicKeyRequest =>
  message?.discriminator === 'derivePublicKeys'

export const isSignTransactionRequest = (
  message?: LedgerRequest,
): message is LedgerSignTransactionRequest =>
  message?.discriminator === 'signTransaction'

export const isSignChallengeRequest = (
  message?: LedgerRequest,
): message is LedgerSignChallengeRequest =>
  message?.discriminator === 'signChallenge'

export const createLedgerSuccessResponse = <T extends LedgerRequest, E>(
  { interactionId, discriminator }: T,
  success: E,
): {
  interactionId: string
  discriminator: T['discriminator']
  success: E
} => ({
  interactionId,
  discriminator,
  success,
})

export const createLedgerErrorResponse = (
  {
    interactionId,
    discriminator,
  }: Pick<LedgerRequest, 'interactionId' | 'discriminator'>,
  message: string,
): LedgerErrorResponse => {
  const errorMapping: Record<string, number> = {
    '6e38': LedgerErrorCode.BlindSigningNotEnabledButRequired,
    '6e50': LedgerErrorCode.UserRejectedSigningOfTransaction,
  }
  return {
    interactionId,
    discriminator,
    error: {
      code: errorMapping[message]
        ? errorMapping[message]
        : LedgerErrorCode.Generic,
      message: message,
    },
  }
}
