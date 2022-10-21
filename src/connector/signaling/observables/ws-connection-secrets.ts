import { config } from 'config'
import { deriveSecretsFromConnectionPassword } from '../secrets'
import { secureRandom } from 'crypto/secure-random'
import { setConnectionId } from 'mixpanel'
import { errAsync } from 'neverthrow'
import { tap, switchMap, share } from 'rxjs'
import { SignalingSubjectsType } from 'connector/signaling/subjects'
import { Logger } from 'loglevel'

export const wsGenerateConnectionSecrets = (
  subjects: SignalingSubjectsType,
  logger: Logger
) =>
  subjects.wsGenerateConnectionSecretsSubject.pipe(
    tap(() => {
      logger.debug(`📡🔐 generating connection secrets`)
      secureRandom(config.secrets.connectionPasswordByteLength).map((buffer) =>
        subjects.wsConnectionPasswordSubject.next(buffer)
      )
    })
  )

export const wsConnectionPassword = (
  subjects: SignalingSubjectsType,
  logger: Logger
) =>
  subjects.wsConnectionPasswordSubject.pipe(
    switchMap((password) =>
      password
        ? deriveSecretsFromConnectionPassword(password, logger)
        : errAsync(Error('missing connection password'))
    ),
    share(),
    tap((result) => {
      if (result.isOk())
        setConnectionId(result.value.connectionId.toString('hex'))

      return subjects.wsConnectionSecretsSubject.next(result)
    })
  )
