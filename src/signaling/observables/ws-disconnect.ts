import {
  combineLatest,
  switchMap,
  interval,
  withLatestFrom,
  filter,
  take,
  tap,
} from 'rxjs'
import { SignalingSubjectsType } from 'signaling/subjects'

export const wsDisconnect = (
  subjects: SignalingSubjectsType,
  disconnect: () => void
) =>
  combineLatest([subjects.wsConnectSubject, subjects.wsStatusSubject]).pipe(
    switchMap(([shouldConnect, status]) => {
      if (['connecting', 'connected'].includes(status) && !shouldConnect) {
        return interval(100).pipe(
          withLatestFrom(subjects.wsIsSendingMessageSubject),
          filter(([, wsIsSendingMessage]) => !wsIsSendingMessage),
          take(1),
          tap(disconnect)
        )
      } else {
        return []
      }
    })
  )
