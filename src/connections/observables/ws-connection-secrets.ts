import { config } from 'config'
import { deriveSecretsFromConnectionPassword } from 'connections/secrets'
import { WebRtcSubjectsType } from 'connections/subjects'
import { secureRandom } from 'crypto/secure-random'
import { setConnectionId } from 'mixpanel'
import { errAsync } from 'neverthrow'
import { tap, switchMap, share } from 'rxjs'

export const wsGenerateConnectionSecrets = (subjects: WebRtcSubjectsType) =>
  subjects.wsGenerateConnectionSecretsSubject.pipe(
    tap(() => {
      secureRandom(config.secrets.connectionPasswordByteLength).map((buffer) =>
        subjects.wsConnectionPasswordSubject.next(buffer)
      )
    })
  )

export const wsConnectionPassword = (subjects: WebRtcSubjectsType) =>
  subjects.wsConnectionPasswordSubject.pipe(
    switchMap((password) =>
      password
        ? deriveSecretsFromConnectionPassword(password)
        : errAsync(Error('missing connection password'))
    ),
    share(),
    tap((result) => {
      if (result.isOk())
        setConnectionId(result.value.connectionId.toString('hex'))
      return subjects.wsConnectionSecretsSubject.next(result)
    })
  )
