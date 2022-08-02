import { Confirmation, SignalingServerErrorResponse } from 'io-types/types'
import { errAsync } from 'neverthrow'
import {
  BehaviorSubject,
  ReplaySubject,
  Subject,
  switchMap,
  share,
  tap,
  Subscription,
} from 'rxjs'
import { deriveSecretsFromConnectionPassword } from './signaling-server-client/secrets'
import { secureRandom } from 'crypto/secure-random'

export type Status = 'connecting' | 'connected' | 'disconnected'

export const wsOfferReceived = new BehaviorSubject<boolean>(false)
export const wsSendAnswer = new ReplaySubject<RTCSessionDescriptionInit>()
export const wsOutgoingMessageSubject = new Subject<string>()
export const wsIncomingRawMessageSubject = new Subject<MessageEvent<string>>()
export const wsErrorSubject = new Subject<Event>()
export const wsStatusSubject = new BehaviorSubject<Status>('disconnected')
export const wsConnect = new BehaviorSubject<boolean>(false)
export const wsConnectionPasswordSubject = new BehaviorSubject<
  Buffer | undefined
>(undefined)
export const wsGenerateConnectionSecretsSubject = new Subject<void>()
export const wsIncomingMessageConfirmationSubject = new Subject<Confirmation>()
export const wsServerErrorResponseSubject =
  new Subject<SignalingServerErrorResponse>()

export const rtcStatusSubject = new BehaviorSubject<'open' | 'closed'>('closed')
export const rtcIncomingMessageSubject = new Subject<string>()
export const rtcOutgoingMessageSubject = new Subject<string>()
export const rtcIceCandidateSubject = new Subject<RTCPeerConnectionIceEvent>()
export const rtcRemoteOfferSubject = new Subject<RTCSessionDescriptionInit>()
export const rtcRemoteAnswerSubject = new Subject<RTCSessionDescriptionInit>()
export const rtcRemoveIceCandidateSubject = new Subject<RTCIceCandidate>()

export const wsConnectionSecrets$ = wsConnectionPasswordSubject.pipe(
  switchMap((password) =>
    password
      ? deriveSecretsFromConnectionPassword(password)
      : errAsync(Error('missing connection password'))
  ),
  share()
)

export const wsGenerateConnectionSecrets$ =
  wsGenerateConnectionSecretsSubject.pipe(
    tap(() => {
      secureRandom(5).map((buffer) => wsConnectionPasswordSubject.next(buffer))
    })
  )

const subscriptions = new Subscription()

subscriptions.add(wsGenerateConnectionSecrets$.subscribe())
