import { Answer, Offer } from 'io-types/types'
import { BehaviorSubject, ReplaySubject, Subject } from 'rxjs'
import { IceCandidateMessage } from 'connector/_types'
import { ChunkedMessageType } from 'connector/helpers'

export type WebRtcSubjectsType = ReturnType<typeof WebRtcSubjects>

export const WebRtcSubjects = () => ({
  onNegotiationNeededSubject: new Subject<void>(),
  onIceCandidateSubject: new Subject<RTCIceCandidate>(),
  iceCandidatesSubject: new BehaviorSubject<IceCandidateMessage[]>([]),
  onRemoteIceCandidateSubject: new Subject<RTCIceCandidate>(),
  remoteIceCandidatesSubject: new BehaviorSubject<RTCIceCandidate[]>([]),
  offerSubject: new ReplaySubject<
    Pick<Offer, 'method' | 'payload' | 'source'>
  >(),
  answerSubject: new ReplaySubject<
    Pick<Answer, 'method' | 'payload' | 'source'>
  >(),
  onRemoteAnswerSubject: new Subject<void>(),
  onSignalingStateChangeSubject: new Subject<RTCSignalingState>(),
  dataChannelStatusSubject: new BehaviorSubject<'open' | 'closed'>('closed'),
  onDataChannelMessageSubject: new Subject<ChunkedMessageType>(),
  sendMessageOverDataChannelSubject: new Subject<string>(),
  iceConnectionStateSubject: new Subject<RTCIceConnectionState>(),
})
