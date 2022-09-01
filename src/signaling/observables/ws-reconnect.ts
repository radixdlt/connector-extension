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
} from 'rxjs'
import { SignalingSubjectsType } from 'signaling/subjects'

export const wsReconnect = (subjects: SignalingSubjectsType, logger: Logger) =>
  combineLatest([subjects.wsStatusSubject, subjects.wsConnectSubject]).pipe(
    skip(1),
    filter(
      ([status, shouldConnect]) => status === 'disconnected' && shouldConnect
    ),
    exhaustMap(() =>
      interval(config.signalingServer.reconnect.interval).pipe(
        withLatestFrom(subjects.wsConnectSubject, subjects.wsStatusSubject),
        filter(
          ([, shouldConnect, status]) =>
            shouldConnect && status === 'disconnected'
        ),
        filter(([index, , status]) => {
          logger.debug(
            `🔄 lost connection to signaling server, attempting to reconnect... status: ${status}, attempt: ${
              index + 1
            }`
          )
          subjects.wsConnectSubject.next(true)
          return status === 'connected'
        }),
        tap(() => {
          logger.debug('🤙 successfully reconnected to signaling server')
        }),
        first()
      )
    )
  )
