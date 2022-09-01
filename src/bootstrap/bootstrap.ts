import { config } from 'config'
import log, { LogLevelDesc } from 'loglevel'
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
import { WebRtcClient, WebRtcClientInput } from 'webrtc/webrtc-client'

export type BootstrapType = ReturnType<typeof Bootstrap>

export type BootstrapInput = Partial<{
  id: string
  logger: log.Logger
  logLevel: LogLevelDesc
  signalingLogLevel: LogLevelDesc
  webRtcLoglevel: LogLevelDesc
  storageLogLevel: LogLevelDesc
  webRtcSubjects: WebRtcSubjectsType
  signalingSubjects: SignalingSubjectsType
  storageSubjects: StorageSubjectsType
  webRtcClientOptions: Omit<WebRtcClientInput, 'subjects' | 'logger'>
  signalingClientOptions: Omit<
    SignalingServerClientInput,
    'subjects' | 'logger'
  >
  storageOptions: Omit<StorageInput, 'subjects' | 'logger'>
}>

export const Bootstrap = ({
  id = crypto.randomUUID(),
  logger = log.getLogger(`${id}-connector`),
  logLevel = config.logLevel,
  signalingLogLevel = config.logLevel,
  webRtcLoglevel = config.logLevel,
  storageLogLevel = config.logLevel,
  webRtcSubjects = WebRtcSubjects(),
  signalingSubjects = SignalingSubjects(),
  storageSubjects = StorageSubjects(),
  webRtcClientOptions = {
    peerConnectionConfig: config.webRTC.peerConnectionConfig,
    dataChannelConfig: config.webRTC.dataChannelConfig,
  },
  signalingClientOptions = {
    baseUrl: config.signalingServer.baseUrl,
  },
  storageOptions = { id: 'radix' },
}: BootstrapInput) => {
  logger.setLevel(logLevel)

  logger.info(
    `🏃‍♂️ running in: '${process.env.NODE_ENV}' mode, logLevel: '${logLevel}'`
  )

  const signalingLogger = log.getLogger(`${id}-signaling`)
  signalingLogger.setLevel(signalingLogLevel)

  const signaling = SignalingServerClient({
    ...signalingClientOptions,
    logger: signalingLogger,
    subjects: signalingSubjects,
  })

  const webRtcLogger = log.getLogger(`${id}-webRtc`)
  webRtcLogger.setLevel(webRtcLoglevel)

  const webRtc = WebRtcClient({
    peerConnectionConfig: webRtcClientOptions.peerConnectionConfig,
    dataChannelConfig: webRtcClientOptions.dataChannelConfig,
    logger: webRtcLogger,
    subjects: webRtcSubjects,
  })

  const storageLogger = log.getLogger(`${id}-storage`)
  storageLogger.setLevel(storageLogLevel)

  const storage = StorageClient({
    ...storageOptions,
    subjects: storageSubjects,
    logger: storageLogger,
  })

  setupConnectionPassword(storage.getConnectionPassword, signaling.subjects)

  webRtc.subjects.rtcConnectSubject.next(true)

  const applicationSubscriptions = ApplicationSubscriptions({
    webRtc: webRtc,
    signalingSubjects: signaling.subjects,
    storageSubjects: storage.subjects,
    logger,
  })

  const destroy = () => {
    webRtc.destroy()
    signaling.destroy()
    storage.destroy()
    applicationSubscriptions.unsubscribe()
  }

  return {
    webRtc,
    signaling,
    storage,
    destroy,
    logger,
  }
}
