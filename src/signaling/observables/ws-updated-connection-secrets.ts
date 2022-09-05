import { Logger } from 'loglevel'
import { filter, withLatestFrom, tap } from 'rxjs'
import { SignalingSubjectsType } from 'signaling/subjects'

export const wsUpdatedConnectionSecrets = (
  subjects: SignalingSubjectsType,
  disconnect: () => void,
  logger: Logger
) =>
  subjects.wsConnectionSecretsSubject.pipe(
    withLatestFrom(subjects.wsConnectSubject),
    filter(([, shouldConnect]) => shouldConnect),
    tap(() => {
      logger.debug(`📡🔄 secrets updated, reconnecting`)
      disconnect()
    })
  )
