import { DataTypes } from 'io-types/types'
import { err, errAsync, ok, Result } from 'neverthrow'
import {
  BehaviorSubject,
  filter,
  ReplaySubject,
  Subject,
  first,
  timer,
  merge,
  map,
  switchMap,
  share,
  Subscription,
  withLatestFrom,
  pluck,
} from 'rxjs'
import { parseJSON } from 'utils/parse-json'
import { deriveSecretsFromConnectionPassword } from './signaling-server-client/secrets'

export type Status = 'connecting' | 'connected' | 'disconnected'

export const wsOfferReceived = new BehaviorSubject<boolean>(false)
export const wsSendAnswer = new ReplaySubject<RTCSessionDescriptionInit>()
export const wsOutgoingMessageSubject = new Subject<string>()
export const wsIncomingRawMessageSubject = new Subject<MessageEvent<string>>()
export const wsErrorSubject = new Subject<Event>()
export const wsStatusSubject = new BehaviorSubject<Status>('disconnected')
export const wsConnect = new Subject<void>()
export const wsDisconnect = new Subject<void>()
export const wsConnectionPasswordSubject = new BehaviorSubject<
  string | undefined
>(undefined)
export const wsIncomingMessageConfirmationSubject = new Subject<DataTypes>()

export const rtcStatusSubject = new BehaviorSubject<'open' | 'closed'>('closed')
export const rtcIncomingMessageSubject = new Subject<string>()
export const rtcOutgoingMessageSubject = new Subject<string>()
export const rtcIceCandidate = new Subject<RTCPeerConnectionIceEvent>()

export const wsConnectionSecrets$ = wsConnectionPasswordSubject.pipe(
  switchMap((password) =>
    password
      ? deriveSecretsFromConnectionPassword(Buffer.from(password, 'utf8'))
      : errAsync(Error('missing connection password'))
  )
)

// TODO: add error message type
type ServerResponse = DataTypes | { valid: DataTypes } | { error: any }

export const handleIncomingMessage = (
  result: Result<ServerResponse, Error>
) => {
  // TODO: Handle JSON parse error
  if (result.isErr()) return

  const value = result.value
  const confirmation = (value as { valid: DataTypes }).valid
  const serverError = value as { error: any }

  if (confirmation) {
    wsIncomingMessageConfirmationSubject.next(confirmation)
  } else if (serverError) {
    // TODO: handle server error
  } else {
    return value
  }
}

export const wsIncomingMessage$ = wsIncomingRawMessageSubject.pipe(
  pluck('data'),
  map(parseJSON),
  map(handleIncomingMessage),
  filter((message): message is DataTypes => !!message),
  withLatestFrom(wsConnectionSecrets$),
  map(([message, secrets]) => {
    // TODO: handle secrets error
    if (secrets.isErr()) return
    const encryptedPayload = message.encryptedPayload
  }),
  share()
)

export const messageConfirmation = (requestId: string, timeout: number) =>
  merge(
    wsIncomingMessageConfirmationSubject.pipe(
      filter((message) => message.requestId === requestId),
      map(() => ok(true))
    ),
    timer(timeout).pipe(map(() => err({ requestId, reason: 'timeout' }))),
    wsErrorSubject.pipe(map(() => err({ requestId, reason: 'error' })))
  ).pipe(first())

const subscriptions = new Subscription()

subscriptions.add(wsIncomingMessage$.subscribe())
