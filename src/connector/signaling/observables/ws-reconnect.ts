import { config } from 'config'
import { Logger } from 'loglevel'
import {
  combineLatest,
  skip,
  interval,
  withLatestFrom,
  filter,
  exhaustMap,
  tap,
  first,
  mergeMap,
} from 'rxjs'
import { SignalingSubjectsType } from 'connector/signaling/subjects'

export const wsReconnect = (subjects: SignalingSubjectsType, logger: Logger) =>
  combineLatest([
    subjects.wsStatusSubject,
    subjects.wsConnectSubject,
    subjects.wsConnectionSecretsSubject,
  ]).pipe(
    skip(1),
    filter(([status, shouldConnect, connectionSecretsResult]) =>
      status === 'disconnected' && shouldConnect && connectionSecretsResult
        ? connectionSecretsResult.isOk()
        : false
    ),
    exhaustMap(() =>
      interval(config.signalingServer.reconnect.interval).pipe(
        withLatestFrom(subjects.wsConnectSubject, subjects.wsStatusSubject),
        filter(
          ([, shouldConnect, status]) =>
            shouldConnect && status === 'disconnected'
        ),
        mergeMap(([index]) =>
          subjects.wsStatusSubject.pipe(
            filter((status) => {
              if (index > 0)
                logger.debug(
                  `📡🔄 lost connection to signaling server, attempting to reconnect... status: ${status}, attempt: ${
                    index + 1
                  }`
                )

              subjects.wsConnectSubject.next(true)
              return status === 'connected'
            }),
            tap(() => {
              if (index > 0)
                logger.debug(
                  '📡🤙 successfully reconnected to signaling server'
                )
            })
          )
        ),
        first()
      )
    )
  )
