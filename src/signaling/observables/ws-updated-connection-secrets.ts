import { Logger } from 'loglevel'
import { filter, withLatestFrom, tap } from 'rxjs'
import { SignalingSubjectsType } from 'signaling/subjects'

export const wsUpdatedConnectionSecrets = (
  subjects: SignalingSubjectsType,
  disconnect: () => void,
  logger: Logger
  // eslint-disable-next-line max-params
) =>
  subjects.wsConnectionSecretsSubject.pipe(
    withLatestFrom(subjects.wsConnectSubject, subjects.wsStatusSubject),
    filter(([, shouldConnect, status]) => shouldConnect),
    tap(([secrets, , status]) => {
      logger.debug(`📡🔐🔄 connection secrets updated`)
      if (['connected', 'connecting'].includes(status)) {
        disconnect()
      }
    })
  )
