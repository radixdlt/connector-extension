import { Logger } from 'tslog'
import { BehaviorSubject } from 'rxjs'
import { deriveSecretsFromPassword as deriveSecretsFromPasswordFn } from './helpers/derive-secrets-from-connection-password'
import { generateConnectionPassword } from './helpers/generate-connection-password'
import { Secrets } from './_types'

export const SecretsClient = (input: { logger?: Logger<unknown> }) => {
  const logger = input.logger
  const secretsSubject = new BehaviorSubject<Secrets | undefined>(undefined)

  const generateConnectionSecrets = () =>
    generateConnectionPassword().asyncAndThen((password) =>
      deriveSecretsFromPasswordFn(password).map((secrets) => {
        logger?.debug(`🔐🔄 connection password generated`)
        secretsSubject.next(secrets)
        return password
      }),
    )

  const deriveSecretsFromPassword = (password: Buffer) =>
    deriveSecretsFromPasswordFn(password).map((secrets) => {
      if (!secretsSubject.value?.encryptionKey.equals(secrets.encryptionKey))
        secretsSubject.next(secrets)
    })

  return {
    generateConnectionSecrets,
    deriveSecretsFromPassword,
    secrets$: secretsSubject,
  }
}
