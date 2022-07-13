import { BehaviorSubject, ReplaySubject, Subject } from 'rxjs'

type Status = 'connecting' | 'connected' | 'disconnected'

export const wsOfferReceived = new BehaviorSubject<boolean>(false)
export const wsSendAnswer = new ReplaySubject<RTCSessionDescriptionInit>()
export const wsMessageSubject = new Subject<MessageEvent<string>>()
export const wsStatusSubject = new BehaviorSubject<Status>('connecting')

export const rtcStatusSubject = new BehaviorSubject<'open' | 'closed'>('closed')
export const rtcIncommingMessageSubject = new Subject<string>()
export const rtcOutgoingMessageSubject = new Subject<string>()
export const rtcIceCandidate = new Subject<RTCPeerConnectionIceEvent>()
