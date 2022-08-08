import { bech32Encode, convertBufferToBech32 } from 'crypto/bech32'
import { deriveKey } from 'crypto/kdf'
import { secureRandom } from 'crypto/secure-random'
import { sha256 } from 'crypto/sha256'
import log from 'loglevel'
import { ResultAsync } from 'neverthrow'

export type Secrets = {
  passwordBech32: string
  encryptionKey: Buffer
  connectionId: Buffer
  // useful for testing
  _connectionPasswordRaw: Buffer
}

export const deriveSecretsFromConnectionPassword = (
  connectionPasswordRaw: Buffer
): ResultAsync<Secrets, Error> =>
  ResultAsync.combine([
    deriveKey(connectionPasswordRaw),
    sha256(connectionPasswordRaw),
  ]).andThen(([encryptionKey, connectionId]) =>
    convertBufferToBech32(connectionPasswordRaw)
      .andThen(bech32Encode)
      .map((passwordBech32) => {
        const secrets = {
          passwordBech32,
          encryptionKey,
          connectionId,
          _connectionPasswordRaw: connectionPasswordRaw,
        }
        log.debug(
          `🔐 derived secrets from connection password:\n${passwordBech32}\n[${
            connectionPasswordRaw.toJSON().data
          }]`
        )
        return secrets
      })
  )

export const generateConnectionPasswordAndDeriveSecrets = (
  byteCount = 5
): ResultAsync<Secrets, Error> =>
  secureRandom(byteCount).asyncAndThen(deriveSecretsFromConnectionPassword)
