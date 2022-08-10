import { deriveSecretsFromConnectionPassword } from 'connections/secrets'
import { SubjectsType } from 'connections/subjects'
import { secureRandom } from 'crypto/secure-random'
import { errAsync } from 'neverthrow'
import { tap, switchMap, share } from 'rxjs'

export const wsGenerateConnectionSecrets = (subjects: SubjectsType) =>
  subjects.wsGenerateConnectionSecretsSubject.pipe(
    tap(() => {
      secureRandom(5).map((buffer) =>
        subjects.wsConnectionPasswordSubject.next(buffer)
      )
    })
  )

export const wsConnectionPassword = (subjects: SubjectsType) =>
  subjects.wsConnectionPasswordSubject.pipe(
    switchMap((password) =>
      password
        ? deriveSecretsFromConnectionPassword(password)
        : errAsync(Error('missing connection password'))
    ),
    share(),
    tap((result) => subjects.wsConnectionSecretsSubject.next(result))
  )
