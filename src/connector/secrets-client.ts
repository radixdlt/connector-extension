import { Logger } from 'tslog'
import { ReplaySubject, share, tap } from 'rxjs'
import { deriveSecretsFromPassword } from './helpers/derive-secrets-from-connection-password'
import { generateConnectionPassword } from './helpers/generate-connection-password'
import { Secrets } from './_types'

export const SecretsClient = (input: { logger?: Logger<unknown> }) => {
  const logger = input.logger
  const secretsSubject = new ReplaySubject<Secrets>()

  const generateConnectionSecrets = () =>
    generateConnectionPassword().asyncAndThen((password) =>
      deriveSecretsFromPassword(password).map((secrets) => {
        logger?.debug(`🔐🔄 connection password generated`)
        secretsSubject.next(secrets)
        return password
      })
    )

  return {
    generateConnectionSecrets,
    deriveSecretsFromPassword: (password: Buffer) =>
      deriveSecretsFromPassword(password).map((secrets) => {
        secretsSubject.next(secrets)
      }),
    secrets$: secretsSubject.pipe(
      tap(() => {
        logger?.debug(`🔐💾 connection password set`)
      }),
      share()
    ),
  }
}
