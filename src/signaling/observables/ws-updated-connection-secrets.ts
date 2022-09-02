import { Logger } from 'loglevel'
import { filter, withLatestFrom, tap } from 'rxjs'
import { SignalingSubjectsType } from 'signaling/subjects'

export const wsUpdatedConnectionSecrets = (
  subjects: SignalingSubjectsType,
  disconnect: () => void,
  logger: Logger
) =>
  subjects.wsConnectionPasswordSubject.pipe(
    withLatestFrom(subjects.wsConnectSubject, subjects.wsStatusSubject),
    filter(
      ([, shouldConnect, status]) =>
        shouldConnect && ['connected', 'connecting'].includes(status)
    ),
    tap(() => {
      logger.debug(`📡🔄 secrets updated, reconnecting`)
      disconnect()
    })
  )
