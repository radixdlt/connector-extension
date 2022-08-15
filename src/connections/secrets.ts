import { config } from 'config'
import { secureRandom } from 'crypto/secure-random'
import { sha256 } from 'crypto/sha256'
import log from 'loglevel'
import { ResultAsync } from 'neverthrow'
import { Buffer } from 'buffer'

export type Secrets = {
  encryptionKey: Buffer
  connectionId: Buffer
}

export const deriveSecretsFromConnectionPassword = (
  encryptionKey: Buffer
): ResultAsync<Secrets, Error> =>
  sha256(encryptionKey).map((connectionId) => {
    const secrets = {
      connectionId,
      encryptionKey,
    }
    log.debug(
      `🔐 encryptionKey:\n[${
        encryptionKey.toJSON().data
      }]\nconnection ID:\n${connectionId.toString('hex')}`
    )
    return secrets
  })

export const generateConnectionPasswordAndDeriveSecrets = (
  byteCount = config.secrets.connectionPasswordByteLength
): ResultAsync<Secrets, Error> =>
  secureRandom(byteCount).asyncAndThen(deriveSecretsFromConnectionPassword)
