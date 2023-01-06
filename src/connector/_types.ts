import { IceCandidate, MessageSources } from 'io-types/types'
import { SignalingClientType } from './signaling/signaling-client'
import { WebRtcClient } from './webrtc/webrtc-client'

export const remoteClientState = {
  remoteClientIsAlreadyConnected: 'remoteClientIsAlreadyConnected',
  remoteClientDisconnected: 'remoteClientDisconnected',
  remoteClientJustConnected: 'remoteClientJustConnected',
} as const

export const remoteClientConnected = new Set<string>([
  remoteClientState.remoteClientIsAlreadyConnected,
  remoteClientState.remoteClientJustConnected,
])

export const remoteClientDisconnected = new Set<string>([
  remoteClientState.remoteClientDisconnected,
])

export type Dependencies = {
  secrets: Secrets
  signalingClient: SignalingClientType
  webRtcClient: WebRtcClient
  source: MessageSources
}

export type IceCandidateMessage = Pick<
  IceCandidate,
  'method' | 'payload' | 'source'
>

export type Message = Record<string, any>

export type Secrets = {
  encryptionKey: Buffer
  connectionId: Buffer
}

export type Status =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'disconnecting'
