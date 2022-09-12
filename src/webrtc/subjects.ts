import { BehaviorSubject, Subject } from 'rxjs'
import { MessageConfirmation, MessageErrorTypes } from './data-chunking'

export type Status =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'disconnecting'
export type WebRtcSubjectsType = ReturnType<typeof WebRtcSubjects>

export const WebRtcSubjects = () => ({
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
  rtcAddMessageToQueue: new Subject<any>(),
})
