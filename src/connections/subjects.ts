import {
  Confirmation,
  MessageSources,
  SignalingServerErrorResponse,
} from 'io-types/types'
import { Result } from 'neverthrow'
import { BehaviorSubject, ReplaySubject, Subject } from 'rxjs'
import { Secrets } from './secrets'
import { MessageConfirmation, MessageErrorTypes } from './data-chunking'

export type Status =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'disconnecting'
export type SubjectsType = ReturnType<typeof Subjects>

export const Subjects = () => {
  const wsOfferReceivedSubject = new BehaviorSubject<boolean>(false)
  const wsSourceSubject = new ReplaySubject<MessageSources>()
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
  const wsIsSendingMessageSubject = new BehaviorSubject<boolean>(false)

  const rtcConnectSubject = new BehaviorSubject<boolean>(false)
  const rtcStatusSubject = new BehaviorSubject<Status>('disconnected')
  const rtcIncomingChunkedMessageSubject = new Subject<ArrayBuffer | string>()
  const rtcIncomingMessageSubject = new Subject<string>()
  const rtcOutgoingMessageSubject = new Subject<string>()
  const rtcOutgoingConfirmationMessageSubject =
    new Subject<MessageConfirmation>()
  const rtcOutgoingErrorMessageSubject = new Subject<MessageErrorTypes>()
  const rtcOutgoingChunkedMessageSubject = new Subject<string>()
  const rtcLocalIceCandidateSubject = new Subject<RTCIceCandidate>()
  const rtcLocalAnswerSubject = new Subject<RTCSessionDescriptionInit>()
  const rtcLocalOfferSubject = new Subject<RTCSessionDescriptionInit>()
  const rtcRemoteOfferSubject = new Subject<RTCSessionDescriptionInit>()
  const rtcRemoteAnswerSubject = new Subject<RTCSessionDescriptionInit>()
  const rtcRemoteIceCandidateSubject = new Subject<RTCIceCandidate>()
  const rtcCreateOfferSubject = new Subject<void>()
  const rtcIceConnectionStateSubject = new Subject<RTCIceConnectionState>()
  const rtcRestartSubject = new Subject<void>()

  return {
    wsOfferReceivedSubject,
    wsSourceSubject,
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
    wsIsSendingMessageSubject,
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
    rtcIceConnectionStateSubject,
    rtcRestartSubject,
  }
}

export const subjects = Subjects()
