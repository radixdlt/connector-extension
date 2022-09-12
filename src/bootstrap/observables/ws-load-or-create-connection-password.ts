import { ResultAsync } from 'neverthrow'
import { map, switchMap } from 'rxjs'
import { SignalingSubjectsType } from 'signaling/subjects'
import { Buffer } from 'buffer'
import { Logger } from 'loglevel'

export const loadOrGenerateConnectionPassword = (
  signalingSubjects: SignalingSubjectsType,
  getConnectionPassword: () => ResultAsync<string, Error>,
  logger: Logger
) =>
  signalingSubjects.wsLoadOrCreateConnectionPasswordSubject.pipe(
    switchMap(getConnectionPassword),
    map((result) =>
      result.map((password) => {
        if (password) {
          logger.debug(`🔐 setting connection password`)
          signalingSubjects.wsConnectionPasswordSubject.next(
            Buffer.from(password, 'hex')
          )
        } else {
          logger.debug(`🔐 generating connection password`)
          signalingSubjects.wsGenerateConnectionSecretsSubject.next()
        }
        return password
      })
    )
  )
