import { z, literal, object, string, union, boolean } from 'zod'
import { LedgerErrorCode } from './wrapper/constants'

const curve = union([literal('curve25519'), literal('secp256k1')])

const ledgerDeviceModel = union([
  literal('nanoS'),
  literal('nanoS+'),
  literal('nanoX'),
])

const ledgerDiscriminator = union([
  literal('getDeviceInfo'),
  literal('derivePublicKeys'),
  literal('signTransaction'),
  literal('signChallenge'),
  literal('deriveAndDisplayAddress'),
])

export const LedgerDiscriminator: Record<
  z.infer<typeof ledgerDiscriminator>,
  string
> = {
  getDeviceInfo: 'getDeviceInfo',
  derivePublicKeys: 'derivePublicKeys',
  signTransaction: 'signTransaction',
  signChallenge: 'signChallenge',
  deriveAndDisplayAddress: 'deriveAndDisplayAddress',
} as const

export const LedgerDeviceSchema = object({
  name: string().optional(),
  model: ledgerDeviceModel,
  id: string(),
})

export type LedgerDevice = z.infer<typeof LedgerDeviceSchema>

export const KeyParametersSchema = object({
  curve,
  derivationPath: string(),
})

export type KeyParameters = z.infer<typeof KeyParametersSchema>

export const LedgerDeviceIdRequestSchema = object({
  interactionId: string(),
  discriminator: literal('getDeviceInfo'),
})

export type LedgerDeviceIdRequest = z.infer<typeof LedgerDeviceIdRequestSchema>

export const LedgerDeriveAndDisplayAddressRequestSchema = object({
  interactionId: string(),
  discriminator: literal('deriveAndDisplayAddress'),
  keyParameters: KeyParametersSchema,
  ledgerDevice: LedgerDeviceSchema,
})

export type LedgerDeriveAndDisplayAddressRequest = z.infer<
  typeof LedgerDeriveAndDisplayAddressRequestSchema
>

export const LedgerPublicKeyRequestSchema = object({
  interactionId: string(),
  discriminator: literal('derivePublicKeys'),
  keysParameters: KeyParametersSchema.array(),
  ledgerDevice: LedgerDeviceSchema,
})

export type LedgerPublicKeyRequest = z.infer<
  typeof LedgerPublicKeyRequestSchema
>

export const LedgerSignTransactionRequestSchema = object({
  interactionId: string(),
  discriminator: literal('signTransaction'),
  signers: KeyParametersSchema.array(),
  ledgerDevice: LedgerDeviceSchema,
  displayHash: boolean(),
  compiledTransactionIntent: string(),
  mode: union([literal('verbose'), literal('summary')]).optional(),
})

export type LedgerSignTransactionRequest = z.infer<
  typeof LedgerSignTransactionRequestSchema
>

export const LedgerSignChallengeRequestSchema = object({
  interactionId: string(),
  discriminator: literal('signChallenge'),
  signers: KeyParametersSchema.array(),
  ledgerDevice: LedgerDeviceSchema,
  challenge: string(),
  origin: string(),
  dAppDefinitionAddress: string(),
})

export type LedgerSignChallengeRequest = z.infer<
  typeof LedgerSignChallengeRequestSchema
>

export const LedgerRequestSchema = union([
  LedgerDeviceIdRequestSchema,
  LedgerPublicKeyRequestSchema,
  LedgerSignTransactionRequestSchema,
  LedgerSignChallengeRequestSchema,
  LedgerDeriveAndDisplayAddressRequestSchema,
]).describe('LedgerRequest')

export type LedgerRequest = z.infer<typeof LedgerRequestSchema>

export const LedgerDeviceIdResponseSchema = object({
  interactionId: string(),
  discriminator: literal('getDeviceInfo'),
  success: object({
    model: ledgerDeviceModel,
    id: string(),
  }),
})

export type LedgerDeviceIdResponse = z.infer<
  typeof LedgerDeviceIdResponseSchema
>

export const DerivedPublicKeySchema = object({
  curve,
  publicKey: string(),
  derivationPath: string(),
})

export type DerivedPublicKey = z.infer<typeof DerivedPublicKeySchema>

export const DerivedAddressSchema = object({
  derivedKey: DerivedPublicKeySchema,
  address: string(),
})

export type DerivedAddress = z.infer<typeof DerivedAddressSchema>

export const SignatureOfSignerSchema = object({
  derivedPublicKey: DerivedPublicKeySchema,
  signature: string(),
})

export type SignatureOfSigner = z.infer<typeof SignatureOfSignerSchema>

export const LedgerPublicKeyResponseSchema = object({
  interactionId: string(),
  discriminator: literal('derivePublicKeys'),
  success: DerivedPublicKeySchema.array(),
})

export type LedgerPublicKeyResponse = z.infer<
  typeof LedgerPublicKeyResponseSchema
>

export const LedgerSignTransactionResponseSchema = object({
  interactionId: string(),
  discriminator: literal('signTransaction'),
  success: SignatureOfSignerSchema.array(),
})

export type LedgerSignTransactionResponse = z.infer<
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
  success: SignatureOfSignerSchema.array(),
})

export type LedgerSignChallengeResponse = z.infer<
  typeof LedgerSignChallengeResponseSchema
>

export const LedgerErrorResponseSchema = object({
  interactionId: string(),
  discriminator: ledgerDiscriminator,
  error: object({
    message: string(),
  }),
})

export const LedgerSuccessResponseSchema = union([
  LedgerDeviceIdResponseSchema,
  LedgerPublicKeyResponseSchema,
  LedgerSignTransactionResponseSchema,
  LedgerSignChallengeResponseSchema,
  LedgerDeriveAndDisplayAddressResponseSchema,
])

export type LedgerSuccessResponse = z.infer<typeof LedgerSuccessResponseSchema>

export type LedgerErrorResponse = z.infer<typeof LedgerErrorResponseSchema>

export const LedgerResponseSchema = union([
  LedgerSuccessResponseSchema,
  LedgerErrorResponseSchema,
])

export type LedgerResponse = z.infer<typeof LedgerResponseSchema>

export const isLedgerRequest = (message: any): message is LedgerRequest =>
  [
    'getDeviceInfo',
    'derivePublicKeys',
    'signTransaction',
    'signChallenge',
    'deriveAndDisplayAddress',
  ].includes(message?.discriminator)

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
) => {
  return {
    interactionId,
    discriminator,
    error: {
      code:
        message === '6e38'
          ? LedgerErrorCode.BlindSigningNotEnabledButRequired
          : LedgerErrorCode.Generic,
      message: message,
    },
  }
}
