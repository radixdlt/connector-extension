import {
  Confirmation,
  MessageSources,
  SignalingServerErrorResponse,
} from 'io-types/types'
import { errAsync, Result } from 'neverthrow'
import {
  BehaviorSubject,
  ReplaySubject,
  Subject,
  switchMap,
  share,
  tap,
  Subscription,
} from 'rxjs'
import { deriveSecretsFromConnectionPassword, Secrets } from './secrets'
import { secureRandom } from 'crypto/secure-random'
import { MessageConfirmation } from './data-chunking'

export type Status = 'connecting' | 'connected' | 'disconnected'
export type DataChannelStatus = 'open' | 'closed'
export type SubjectsType = ReturnType<typeof Subjects>

export const Subjects = () => {
  const wsOfferReceived = new BehaviorSubject<boolean>(false)
  const wsSource = new ReplaySubject<MessageSources>()
  const wsOutgoingMessageSubject = new Subject<string>()
  const wsIncomingRawMessageSubject = new Subject<MessageEvent<string>>()
  const wsErrorSubject = new Subject<Event>()
  const wsStatusSubject = new BehaviorSubject<Status>('disconnected')
  const wsConnectSubject = new BehaviorSubject<boolean>(false)
  const wsConnectionPasswordSubject = new BehaviorSubject<Buffer | undefined>(
    undefined
  )
  const wsConnectionSecretsSubject = new BehaviorSubject<
    Result<Secrets, Error> | undefined
  >(undefined)
  const wsGenerateConnectionSecretsSubject = new Subject<void>()
  const wsIncomingMessageConfirmationSubject = new Subject<Confirmation>()
  const wsServerErrorResponseSubject =
    new Subject<SignalingServerErrorResponse>()

  const rtcConnectSubject = new BehaviorSubject<boolean>(false)
  const rtcStatusSubject = new BehaviorSubject<DataChannelStatus>('closed')
  const rtcIncomingChunkedMessageSubject = new Subject<ArrayBuffer | string>()
  const rtcIncomingMessageSubject = new Subject<string>()
  const rtcOutgoingMessageSubject = new Subject<string>()
  const rtcOutgoingConfirmationMessageSubject =
    new Subject<MessageConfirmation>()
  const rtcOutgoingErrorMessageSubject = new Subject<string>()
  const rtcOutgoingChunkedMessageSubject = new Subject<string>()
  const rtcLocalIceCandidateSubject = new Subject<RTCIceCandidate>()
  const rtcLocalAnswerSubject = new Subject<RTCSessionDescriptionInit>()
  const rtcLocalOfferSubject = new Subject<RTCSessionDescriptionInit>()
  const rtcRemoteOfferSubject = new Subject<RTCSessionDescriptionInit>()
  const rtcRemoteAnswerSubject = new Subject<RTCSessionDescriptionInit>()
  const rtcRemoteIceCandidateSubject = new Subject<RTCIceCandidate>()
  const rtcCreateOfferSubject = new Subject<void>()

  const allSubjects = {
    wsOfferReceived,
    wsSource,
    wsOutgoingMessageSubject,
    wsIncomingRawMessageSubject,
    wsErrorSubject,
    wsStatusSubject,
    wsConnectSubject,
    wsConnectionPasswordSubject,
    wsConnectionSecretsSubject,
    wsGenerateConnectionSecretsSubject,
    wsIncomingMessageConfirmationSubject,
    wsServerErrorResponseSubject,
    rtcConnectSubject,
    rtcStatusSubject,
    rtcIncomingMessageSubject,
    rtcIncomingChunkedMessageSubject,
    rtcOutgoingConfirmationMessageSubject,
    rtcOutgoingErrorMessageSubject,
    rtcOutgoingMessageSubject,
    rtcOutgoingChunkedMessageSubject,
    rtcLocalIceCandidateSubject,
    rtcLocalAnswerSubject,
    rtcRemoteOfferSubject,
    rtcRemoteAnswerSubject,
    rtcRemoteIceCandidateSubject,
    rtcCreateOfferSubject,
    rtcLocalOfferSubject,
  }

  const wsConnectionSecrets$ = wsConnectionPasswordSubject.pipe(
    switchMap((password) =>
      password
        ? deriveSecretsFromConnectionPassword(password)
        : errAsync(Error('missing connection password'))
    ),
    share(),
    tap((result) => wsConnectionSecretsSubject.next(result))
  )

  const wsGenerateConnectionSecrets$ = wsGenerateConnectionSecretsSubject.pipe(
    tap(() => {
      secureRandom(5).map((buffer) => wsConnectionPasswordSubject.next(buffer))
    })
  )

  const subscriptions = new Subscription()
  subscriptions.add(wsConnectionSecrets$.subscribe())
  subscriptions.add(wsGenerateConnectionSecrets$.subscribe())
  // subscriptions.add(rtcLocalOfferSubject.subscribe(console.log))

  return {
    ...allSubjects,
    wsConnectionSecrets$,
    wsGenerateConnectionSecrets$,
    subscriptions,
  }
}

export const subjects = Subjects()
