import { config } from 'config'
import log, { LogLevelDesc } from 'loglevel'
import { MessageClient } from 'messages/message-client'
import { MessageSubjects, MessageSubjectsType } from 'messages/subjects'
import {
  SignalingServerClient,
  SignalingServerClientInput,
} from 'signaling/signaling-server-client'
import { SignalingSubjects, SignalingSubjectsType } from 'signaling/subjects'
import { StorageSubjects, StorageSubjectsType } from 'storage/subjects'
import { StorageClient, StorageInput } from '../storage/storage-client'
import { ApplicationSubscriptions } from './subscriptions'
import { setupConnectionPassword } from './setup-connection-password'
import { WebRtcSubjects, WebRtcSubjectsType } from 'webrtc/subjects'
import { WebRtcClientInput, WebRtcClient } from 'webrtc/webrtc-client'

export type BootstrapType = ReturnType<typeof Bootstrap>

export type BootstrapInput = Partial<{
  logLevel: LogLevelDesc
  webRtcSubjects: WebRtcSubjectsType
  webRtcClientOptions: Omit<
    WebRtcClientInput,
    'signalingServerOptions' | 'subjects'
  >
  signalingSubjects: SignalingSubjectsType
  signalingServerOptions: Omit<SignalingServerClientInput, 'subjects'>
  messageSubjects: MessageSubjectsType
  storageSubjects: StorageSubjectsType
  storageOptions: Omit<StorageInput, 'subjects'>
}>

export const Bootstrap = ({
  logLevel = config.logLevel,
  webRtcSubjects = WebRtcSubjects(),
  signalingSubjects = SignalingSubjects(),
  messageSubjects = MessageSubjects(),
  storageSubjects = StorageSubjects(),
  webRtcClientOptions = {
    webRtcOptions: {
      peerConnectionConfig: config.webRTC.peerConnectionConfig,
      dataChannelConfig: config.webRTC.dataChannelConfig,
    },
  },
  signalingServerOptions = {
    baseUrl: config.signalingServer.baseUrl,
  },
  storageOptions = { id: 'radix' },
}: BootstrapInput) => {
  log.setLevel(logLevel)

  log.info(
    `🏃‍♂️ running in: '${process.env.NODE_ENV}' mode, logLevel: '${config.logLevel}'`
  )

  const webRtc = WebRtcClient({
    ...webRtcClientOptions,
    subjects: webRtcSubjects,
  })

  const signaling = SignalingServerClient({
    ...signalingServerOptions,
    subjects: signalingSubjects,
  })

  const storage = StorageClient({
    ...storageOptions,
    subjects: storageSubjects,
  })

  const message = MessageClient(messageSubjects)

  setupConnectionPassword(storage.getConnectionPassword, signaling.subjects)

  webRtc.subjects.rtcConnectSubject.next(true)

  const applicationSubscriptions = ApplicationSubscriptions({
    webRtc: webRtc,
    signalingSubjects: signaling.subjects,
    storageSubjects: storage.subjects,
    messageSubjects: message.subjects,
  })

  const destroy = () => {
    webRtc.destroy()
    signaling.destroy()
    storage.destroy()
    message.destroy()
    applicationSubscriptions.unsubscribe()
  }

  return {
    webRtc,
    signaling,
    storage,
    message,
    destroy,
  }
}
