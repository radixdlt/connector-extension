import { bech32Encode, convertBufferToBech32 } from 'crypto/bech32'
import { deriveKey } from 'crypto/kdf'
import { secureRandom } from 'crypto/secure-random'
import { sha256 } from 'crypto/sha256'
import { combine, ResultAsync } from 'neverthrow'

type Secrets = {
  passwordBech32: string
  encryptionKey: Buffer
  connectionId: Buffer
  // useful for testing
  _connectionPasswordRaw: Buffer
}

export const deriveSecretsFromConnectionPassword = (
  connectionPasswordRaw: Buffer
): ResultAsync<Secrets, Error> =>
  combine([
    deriveKey(connectionPasswordRaw),
    sha256(connectionPasswordRaw),
  ]).andThen(([encryptionKey, connectionId]) =>
    convertBufferToBech32(connectionPasswordRaw)
      .andThen(bech32Encode)
      .map((passwordBech32) => ({
        passwordBech32,
        encryptionKey,
        connectionId,
        _connectionPasswordRaw: connectionPasswordRaw,
      }))
  )

export const generateConnectionPasswordAndDeriveSecrets = (
  byteCount = 5
): ResultAsync<Secrets, Error> =>
  secureRandom(byteCount).asyncAndThen(deriveSecretsFromConnectionPassword)
