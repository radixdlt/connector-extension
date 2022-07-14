import { err, ok } from 'neverthrow'
import {
  BehaviorSubject,
  filter,
  ReplaySubject,
  Subject,
  first,
  timer,
  merge,
  map,
} from 'rxjs'

export type Status = 'connecting' | 'connected' | 'disconnected'

export const wsOfferReceived = new BehaviorSubject<boolean>(false)
export const wsSendAnswer = new ReplaySubject<RTCSessionDescriptionInit>()
export const wsOutgoingMessageSubject = new Subject<string>()
export const wsIncomingMessageSubject = new Subject<MessageEvent<string>>()
export const wsErrorSubject = new Subject<Event>()
export const wsStatusSubject = new BehaviorSubject<Status>('disconnected')
export const wsConnect = new Subject<void>()
export const wsDisconnect = new Subject<void>()

export const rtcStatusSubject = new BehaviorSubject<'open' | 'closed'>('closed')
export const rtcIncomingMessageSubject = new Subject<string>()
export const rtcOutgoingMessageSubject = new Subject<string>()
export const rtcIceCandidate = new Subject<RTCPeerConnectionIceEvent>()

export const messageConfirmation = (requestId: string, timeout: number) =>
  merge(
    wsIncomingMessageSubject.pipe(
      filter(
        (incomingMessage) =>
          // TODO: use safe parsing
          JSON.parse(incomingMessage.data).valid.requestId === requestId
      ),
      map(() => ok(requestId))
    ),
    timer(timeout).pipe(map(() => err({ requestId, reason: 'timeout' }))),
    wsErrorSubject.pipe(map(() => err({ requestId, reason: 'error' })))
  ).pipe(first())
