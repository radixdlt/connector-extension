import {
  Confirmation,
  MessageSources,
  SignalingServerErrorResponse,
} from 'io-types/types'
import { Result } from 'neverthrow'
import { BehaviorSubject, ReplaySubject, Subject } from 'rxjs'
import { Secrets } from './secrets'
import { MessageConfirmation, MessageErrorTypes } from './data-chunking'
import { Buffer } from 'buffer'

export type Status =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'disconnecting'
export type SubjectsType = ReturnType<typeof Subjects>

export const Subjects = () => ({
  wsOfferReceivedSubject: new BehaviorSubject<boolean>(false),
  wsSourceSubject: new ReplaySubject<MessageSources>(),
  wsOutgoingMessageSubject: new Subject<string>(),
  wsIncomingRawMessageSubject: new Subject<MessageEvent<string>>(),
  wsErrorSubject: new Subject<Event>(),
  wsStatusSubject: new BehaviorSubject<Status>('disconnected'),
  wsConnectSubject: new BehaviorSubject<boolean>(false),
  wsConnectionPasswordSubject: new BehaviorSubject<Buffer | undefined>(
    undefined
  ),
  wsConnectionSecretsSubject: new BehaviorSubject<
    Result<Secrets, Error> | undefined
  >(undefined),
  wsGenerateConnectionSecretsSubject: new Subject<void>(),
  wsIncomingMessageConfirmationSubject: new Subject<Confirmation>(),
  wsServerErrorResponseSubject: new Subject<SignalingServerErrorResponse>(),
  wsIsSendingMessageSubject: new BehaviorSubject<boolean>(false),
  wsAutoConnect: new BehaviorSubject<boolean>(false),
  rtcConnectSubject: new BehaviorSubject<boolean>(false),
  rtcStatusSubject: new BehaviorSubject<Status>('disconnected'),
  rtcIncomingChunkedMessageSubject: new Subject<ArrayBuffer | string>(),
  rtcIncomingMessageSubject: new Subject<string>(),
  rtcOutgoingMessageSubject: new Subject<string>(),
  rtcOutgoingConfirmationMessageSubject: new Subject<MessageConfirmation>(),
  rtcOutgoingErrorMessageSubject: new Subject<MessageErrorTypes>(),
  rtcOutgoingChunkedMessageSubject: new Subject<string>(),
  rtcLocalIceCandidateSubject: new Subject<RTCIceCandidate>(),
  rtcLocalAnswerSubject: new Subject<RTCSessionDescriptionInit>(),
  rtcLocalOfferSubject: new Subject<RTCSessionDescriptionInit>(),
  rtcRemoteOfferSubject: new Subject<RTCSessionDescriptionInit>(),
  rtcRemoteAnswerSubject: new Subject<RTCSessionDescriptionInit>(),
  rtcRemoteIceCandidateSubject: new Subject<RTCIceCandidate>(),
  rtcCreateOfferSubject: new Subject<void>(),
  rtcIceConnectionStateSubject: new Subject<RTCIceConnectionState>(),
  rtcRestartSubject: new Subject<void>(),
})

export const subjects = Subjects()
