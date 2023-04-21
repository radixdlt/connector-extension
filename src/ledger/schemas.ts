import { z, literal, object, string, union, number } from 'zod'

const curve = union([literal('curve25519'), literal('secp256k1')])

const ledgerDeviceModel = union([
  literal('nanoS'),
  literal('nanoS+'),
  literal('nanoX'),
])

const ledgerModel: Record<string, z.infer<typeof ledgerDeviceModel>> = {
  '00': 'nanoS',
  '01': 'nanoS+',
  '02': 'nanoX',
}

const ledgerDiscriminator = union([
  literal('getDeviceInfo'),
  literal('derivePublicKey'),
  literal('signTransaction'),
  literal('signChallenge'),
  literal('importOlympiaDevice'),
])

export const LedgerDeviceSchema = object({
  name: string().optional(),
  model: ledgerDeviceModel,
  id: string(),
})

export type LedgerDevice = z.infer<typeof LedgerDeviceSchema>

export const LedgerDeviceIdRequestSchema = object({
  interactionId: string(),
  discriminator: literal('getDeviceInfo'),
})

export type LedgerDeviceIdRequest = z.infer<typeof LedgerDeviceIdRequestSchema>

export const LedgerPublicKeyRequestSchema = object({
  interactionId: string(),
  discriminator: literal('derivePublicKey'),
  keyParameters: object({
    curve,
    derivationPath: string(),
  }),
  ledgerDevice: LedgerDeviceSchema,
})

export type LedgerPublicKeyRequest = z.infer<
  typeof LedgerPublicKeyRequestSchema
>

export const LedgerSignTransactionRequestSchema = object({
  interactionId: string(),
  discriminator: literal('signTransaction'),
  keyParameters: object({
    curve,
    derivationPath: string(),
  }),
  ledgerDevice: LedgerDeviceSchema,
  compiledTransactionIntent: string(),
  mode: union([literal('verbose'), literal('summary')]),
})

export type LedgerSignTransactionRequest = z.infer<
  typeof LedgerSignTransactionRequestSchema
>

export const LedgerSignChallengeRequestSchema = object({
  interactionId: string(),
  discriminator: literal('signChallenge'),
  keyParameters: object({
    curve,
    derivationPath: string(),
  }),
  ledgerDevice: LedgerDeviceSchema,
  challenge: string(),
})

export type LedgerSignChallengeRequest = z.infer<
  typeof LedgerSignChallengeRequestSchema
>

export const LedgerImportOlympiaDeviceRequestSchema = object({
  interactionId: string(),
  discriminator: literal('importOlympiaDevice'),
  derivationPaths: string().array(),
})

export type LedgerImportOlympiaDeviceRequest = z.infer<
  typeof LedgerImportOlympiaDeviceRequestSchema
>

export const LedgerRequestSchema = union([
  LedgerDeviceIdRequestSchema,
  LedgerPublicKeyRequestSchema,
  LedgerSignTransactionRequestSchema,
  LedgerSignChallengeRequestSchema,
  LedgerImportOlympiaDeviceRequestSchema,
])

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

export const LedgerPublicKeyResponseSchema = object({
  interactionId: string(),
  discriminator: literal('derivePublicKey'),
  success: object({
    publicKey: string(),
  }),
})

export type LedgerPublicKeyResponse = z.infer<
  typeof LedgerPublicKeyResponseSchema
>

export const LedgerSignTransactionResponseSchema = object({
  interactionId: string(),
  discriminator: literal('signTransaction'),
  success: object({
    signature: string(),
    publicKey: string(),
  }),
})

export type LedgerSignTransactionResponse = z.infer<
  typeof LedgerSignTransactionResponseSchema
>

export const LedgerSignChallengeResponseSchema = object({
  interactionId: string(),
  discriminator: literal('signChallenge'),
  success: object({
    signature: string(),
    publicKey: string(),
  }),
})

export type LedgerSignChallengeResponse = z.infer<
  typeof LedgerSignChallengeResponseSchema
>

export const LedgerImportOlympiaDeviceResponseSchema = object({
  interactionId: string(),
  discriminator: literal('importOlympiaDevice'),
  success: object({
    model: ledgerDeviceModel,
    id: string(),
    derivedPublicKeys: object({
      publicKey: string(),
      path: string(),
    }).array(),
  }),
})

export type LedgerImportOlympiaDeviceResponse = z.infer<
  typeof LedgerImportOlympiaDeviceResponseSchema
>

export const LedgerErrorResponseSchema = object({
  interactionId: string(),
  discriminator: ledgerDiscriminator,
  error: object({
    code: number(),
    message: string(),
  }),
})

export type LedgerErrorResponse = z.infer<typeof LedgerErrorResponseSchema>

export const LedgerResponseSchema = union([
  LedgerDeviceIdResponseSchema,
  LedgerPublicKeyResponseSchema,
  LedgerSignTransactionResponseSchema,
  LedgerSignChallengeResponseSchema,
  LedgerImportOlympiaDeviceResponseSchema,
  LedgerErrorResponseSchema,
])

export type LedgerResponse = z.infer<typeof LedgerResponseSchema>

export const isLedgerRequest = (message: any): message is LedgerRequest =>
  [
    'getDeviceInfo',
    'derivePublicKey',
    'signTransaction',
    'signChallenge',
    'importOlympiaDevice',
  ].includes(message?.discriminator)

export const isDeviceIdRequest = (
  message: LedgerRequest
): message is LedgerDeviceIdRequest => message.discriminator === 'getDeviceInfo'

export const isPublicKeyRequest = (
  message: LedgerRequest
): message is LedgerPublicKeyRequest =>
  message.discriminator === 'derivePublicKey'

export const isSignTransactionRequest = (
  message: LedgerRequest
): message is LedgerSignTransactionRequest =>
  message.discriminator === 'signTransaction'

export const isSignChallengeRequest = (
  message: LedgerRequest
): message is LedgerSignChallengeRequest =>
  message.discriminator === 'signChallenge'

export const isImportOlympiaDeviceRequest = (
  message: LedgerRequest
): message is LedgerImportOlympiaDeviceRequest =>
  message.discriminator === 'importOlympiaDevice'

export const createLedgerDeviceIdResponse = (
  {
    interactionId,
    discriminator,
  }: Pick<LedgerDeviceIdRequest, 'interactionId' | 'discriminator'>,
  ledgerDeviceId: string,
  model: string
): LedgerDeviceIdResponse => ({
  interactionId,
  discriminator,
  success: {
    id: ledgerDeviceId,
    model: ledgerModel[model],
  },
})

export const createSignedTransactionResponse = (
  {
    interactionId,
    discriminator,
  }: Pick<LedgerSignTransactionRequest, 'interactionId' | 'discriminator'>,
  success: {
    publicKey: string
    signature: string
  }
) => ({
  interactionId,
  discriminator,
  success,
})

export const createLedgerOlympiaDeviceResponse = (
  {
    interactionId,
    discriminator,
  }: Pick<LedgerImportOlympiaDeviceRequest, 'interactionId' | 'discriminator'>,
  data: {
    id: string
    model: string
    derivedPublicKeys: {
      publicKey: string
      path: string
    }[]
  }
) => ({
  interactionId,
  discriminator,
  success: {
    ...data,
    model: ledgerModel[data.model],
  },
})

export const createLedgerPublicKeyResponse = (
  {
    interactionId,
    discriminator,
  }: Pick<LedgerPublicKeyRequest, 'interactionId' | 'discriminator'>,
  publicKey: string
): LedgerPublicKeyResponse => ({
  interactionId,
  discriminator,
  success: {
    publicKey,
  },
})

export const createLedgerErrorResponse = (
  {
    interactionId,
    discriminator,
  }: Pick<LedgerRequest, 'interactionId' | 'discriminator'>,
  message: string
) => ({
  interactionId,
  discriminator,
  error: {
    code: 0,
    message,
  },
})
