import { convertBufferToBech32, bech32Encode } from 'crypto/bech32'
import { deriveKey } from 'crypto/kdf'
import { secureRandom } from 'crypto/secure-random'
import { sha256 } from 'crypto/sha256'
import { combine, ResultAsync } from 'neverthrow'

interface Secrets {
  passwordBech32: string
  encryptionKey: Buffer
  connectionId: Buffer
  // useful for testing
  _connectionPasswordRaw: Buffer
}

export const deriveSecretsFromConnectionPassword = (
  connectionPasswordRaw: Buffer
): ResultAsync<Secrets, Error> =>
  deriveKey(connectionPasswordRaw).andThen((encryptionKey) =>
    combine([
      sha256(connectionPasswordRaw),
      convertBufferToBech32(connectionPasswordRaw).andThen(bech32Encode),
    ]).asyncMap((values) => {
      const [connectionId, passwordBech32] = values as [Buffer, string]
      return Promise.resolve({
        passwordBech32,
        encryptionKey,
        connectionId,
        _connectionPasswordRaw: connectionPasswordRaw,
      })
    })
  )

export const generateConnectionPasswordAndDeriveSecrets = (
  byteCount = 5
): ResultAsync<Secrets, Error> =>
  secureRandom(byteCount).asyncAndThen(deriveSecretsFromConnectionPassword)
