import { config } from 'config'
import { secureRandom } from 'crypto/secure-random'
import { sha256 } from 'crypto/sha256'
import { Logger } from 'loglevel'
import { ResultAsync } from 'neverthrow'
import { Buffer } from 'buffer'
import { Secrets } from '../_types'

export const deriveSecretsFromConnectionPassword = (
  encryptionKey: Buffer,
  logger: Logger
): ResultAsync<Secrets, Error> =>
  sha256(encryptionKey).map((connectionId) => {
    const secrets = {
      connectionId,
      encryptionKey,
    }
    logger.debug(
      `🔐 encryptionKey:\n${encryptionKey.toString(
        'hex'
      )}\nconnection ID:\n${connectionId.toString('hex')}\nBuffer:\n[${
        encryptionKey.toJSON().data
      }]`
    )
    return secrets
  })

export const generateConnectionPasswordAndDeriveSecrets = (
  byteCount = config.secrets.connectionPasswordByteLength,
  logger: Logger
): ResultAsync<Secrets, Error> =>
  secureRandom(byteCount).asyncAndThen((buffer) =>
    deriveSecretsFromConnectionPassword(buffer, logger)
  )
