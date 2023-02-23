import {
  IceCandidate,
  MessageSources,
  RemoteClientDisconnected,
  RemoteClientIsAlreadyConnected,
  RemoteClientJustConnected,
  SignalingServerResponse,
} from 'io-types/types'
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

export const isRemoteClientConnectionUpdate = (
  message: SignalingServerResponse
): message is
  | RemoteClientJustConnected
  | RemoteClientIsAlreadyConnected
  | RemoteClientDisconnected =>
  remoteClientConnected.has(message.info) ||
  remoteClientDisconnected.has(message.info)

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
