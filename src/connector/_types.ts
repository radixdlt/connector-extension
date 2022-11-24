import { Logger } from 'loglevel'
import { SignalingServerClientType } from './signaling/signaling-server-client'
import { StorageClientType } from './storage/storage-client'
import { ConnectorSubjectsType } from './subjects'
import { WebRtcClientType } from './webrtc/webrtc-client'

export type Status =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'disconnecting'

export type Secrets = {
  encryptionKey: Buffer
  connectionId: Buffer
}

export type PairingState = 'paired' | 'notPaired' | 'loading'

export type ConnectorSubscriptionsInput = {
  webRtcClient: WebRtcClientType
  storageClient: StorageClientType
  signalingServerClient: SignalingServerClientType
  connectorSubjects: ConnectorSubjectsType
  logger: Logger
}
