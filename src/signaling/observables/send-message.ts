import {
  tap,
  concatMap,
  interval,
  filter,
  take,
  debounceTime,
  merge,
  of,
} from 'rxjs'
import { SignalingSubjectsType } from 'signaling/subjects'

export const sendMessage = (
  subjects: SignalingSubjectsType,
  sendMessage: (message: string) => void,
  getWs: () => WebSocket | undefined
) =>
  subjects.wsOutgoingMessageSubject.pipe(
    tap(() => subjects.wsIsSendingMessageSubject.next(true)),
    concatMap((message) =>
      merge(of(true), interval(100)).pipe(
        filter(() => {
          const ws = getWs()
          return ws ? ws.OPEN === ws.readyState : false
        }),
        take(1),
        tap(() => sendMessage(message))
      )
    ),
    debounceTime(1000),
    tap(() => subjects.wsIsSendingMessageSubject.next(false))
  )
