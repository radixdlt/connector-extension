import { config } from 'config'
import { SubjectsType } from 'connections/subjects'
import log from 'loglevel'
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

export const wsReconnect = (subjects: SubjectsType) =>
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
          log.debug(
            `🔄 lost connection to signaling server, attempting to reconnect... status: ${status}, attempt: ${
              index + 1
            }`
          )
          subjects.wsConnectSubject.next(true)
          return status === 'connected'
        }),
        tap(() => {
          log.debug('🤙 successfully reconnected to signaling server')
        }),
        first()
      )
    )
  )
