import { ResultAsync } from 'neverthrow'
import { map, switchMap } from 'rxjs'
import { SignalingSubjectsType } from 'signaling/subjects'
import { Buffer } from 'buffer'

export const loadOrGenerateConnectionPassword = (
  signalingSubjects: SignalingSubjectsType,
  getConnectionPassword: () => ResultAsync<string, Error>
) =>
  signalingSubjects.wsLoadOrCreateConnectionPasswordSubject.pipe(
    switchMap(getConnectionPassword),
    map((result) =>
      result.map((password) => {
        if (password) {
          signalingSubjects.wsConnectionPasswordSubject.next(
            Buffer.from(password, 'hex')
          )
        } else {
          signalingSubjects.wsGenerateConnectionSecretsSubject.next()
        }
        return password
      })
    )
  )
