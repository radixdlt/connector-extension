import { Secrets } from 'connector/_types'
import { createIV, encrypt } from 'crypto/encryption'
import { DataTypes } from 'io-types/types'
import { ResultAsync } from 'neverthrow'

export const prepareMessage = (
  { payload, method, source }: Pick<DataTypes, 'payload' | 'method' | 'source'>,
  { encryptionKey, connectionId }: Secrets
): ResultAsync<Omit<DataTypes, 'payload'>, Error> =>
  createIV()
    .asyncAndThen((iv) =>
      encrypt(Buffer.from(JSON.stringify(payload)), encryptionKey, iv)
    )
    .map((encrypted) => ({
      requestId: crypto.randomUUID(),
      connectionId: connectionId.toString('hex'),
      encryptedPayload: encrypted.combined.toString('hex'),
      method,
      source,
    }))
