import { decrypt } from 'crypto/encryption'
import { transformBufferToSealbox } from 'crypto/sealbox'
import { DataTypes } from 'io-types/types'
import { ResultAsync } from 'neverthrow'
import { parseJSON } from 'utils'

export const decryptMessagePayload = <T = DataTypes['payload']>(
  message: DataTypes,
  encryptionKey: Buffer,
): ResultAsync<T, Error> =>
  transformBufferToSealbox(Buffer.from(message.encryptedPayload, 'hex'))
    .asyncAndThen(({ ciphertextAndAuthTag, iv }) =>
      decrypt(ciphertextAndAuthTag, encryptionKey, iv),
    )
    .andThen((decrypted) => parseJSON<T>(decrypted.toString('utf8')))
