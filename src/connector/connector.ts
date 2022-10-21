import { config } from 'config'
import log, { LogLevelDesc } from 'loglevel'
import {
  SignalingServerClient,
  SignalingServerClientInput,
} from 'connector/signaling/signaling-server-client'
import {
  SignalingSubjects,
  SignalingSubjectsType,
} from 'connector/signaling/subjects'
import {
  StorageSubjects,
  StorageSubjectsType,
} from 'connector/storage/subjects'
import { StorageClient, StorageInput } from './storage/storage-client'
import { ApplicationSubscriptions } from './subscriptions'
import { WebRtcSubjects, WebRtcSubjectsType } from 'connector/webrtc/subjects'
import { WebRtcClient, WebRtcClientInput } from 'connector/webrtc/webrtc-client'
import { map } from 'rxjs/operators'
import { parseJSON } from 'utils'
import { ok } from 'neverthrow'
import { ConnectorSubjects, ConnectorSubjectsType } from './subjects'
import { Buffer } from 'buffer'

export type ConnectorType = ReturnType<typeof Connector>

export type ConnectorInput = Partial<{
  id: string
  logger: log.Logger
  logLevel: LogLevelDesc
  signalingLogLevel: LogLevelDesc
  webRtcLoglevel: LogLevelDesc
  storageLogLevel: LogLevelDesc
  webRtcSubjects: WebRtcSubjectsType
  signalingSubjects: SignalingSubjectsType
  storageSubjects: StorageSubjectsType
  connectorSubjects: ConnectorSubjectsType
  webRtcClientOptions: Omit<WebRtcClientInput, 'subjects' | 'logger'>
  signalingClientOptions: Omit<
    SignalingServerClientInput,
    'subjects' | 'logger'
  >
  storageOptions: Omit<StorageInput, 'subjects' | 'logger'>
}>

export const Connector = ({
  id = crypto.randomUUID(),
  logger = log.getLogger(`${id}-connector`),
  logLevel = config.logLevel,
  signalingLogLevel,
  webRtcLoglevel,
  storageLogLevel,
  webRtcSubjects = WebRtcSubjects(),
  signalingSubjects = SignalingSubjects(),
  storageSubjects = StorageSubjects(),
  connectorSubjects = ConnectorSubjects(),
  webRtcClientOptions = {
    peerConnectionConfig: config.webRTC.peerConnectionConfig,
    dataChannelConfig: config.webRTC.dataChannelConfig,
  },
  signalingClientOptions = {
    baseUrl: config.signalingServer.baseUrl,
  },
  storageOptions = { id: 'radix' },
}: ConnectorInput) => {
  logger.setLevel(logLevel)

  logger.debug(
    `🏃‍♂️ connector extension running in: '${process.env.NODE_ENV}' mode, logLevel: '${logLevel}'`
  )

  const signalingLogger = log.getLogger(`${id}-signaling`)
  signalingLogger.setLevel(signalingLogLevel || logLevel)

  const signaling = SignalingServerClient({
    ...signalingClientOptions,
    logger: signalingLogger,
    subjects: signalingSubjects,
  })

  const webRtcLogger = log.getLogger(`${id}-webRtc`)
  webRtcLogger.setLevel(webRtcLoglevel || logLevel)

  const webRtc = WebRtcClient({
    peerConnectionConfig: webRtcClientOptions.peerConnectionConfig,
    dataChannelConfig: webRtcClientOptions.dataChannelConfig,
    logger: webRtcLogger,
    subjects: webRtcSubjects,
  })

  const storageLogger = log.getLogger(`${id}-storage`)
  storageLogger.setLevel(storageLogLevel || logLevel)

  const storage = StorageClient({
    ...storageOptions,
    subjects: storageSubjects,
    logger: storageLogger,
  })

  webRtc.subjects.rtcConnectSubject.next(true)

  const applicationSubscriptions = ApplicationSubscriptions({
    webRtc,
    storage,
    signalingSubjects: signaling.subjects,
    connectorSubjects,
    logger,
  })

  const sendMessage = (message: Record<string, any>) => {
    webRtc.subjects.rtcAddMessageToQueue.next(message)
    return ok(true)
  }

  const connect = (value: boolean) => {
    signaling.subjects.wsConnectSubject.next(value)
    webRtc.subjects.rtcConnectSubject.next(value)
  }

  const setConnectionPassword = (password: string) => {
    signaling.subjects.wsConnectionPasswordSubject.next(
      Buffer.from(password, 'hex')
    )
  }

  const init = () => {
    storage.getConnectionPassword().map((connectionPassword) => {
      if (connectionPassword) {
        logger.debug(`🔐 setting connectionPassword`)
        signalingSubjects.wsConnectionPasswordSubject.next(
          Buffer.from(connectionPassword, 'hex')
        )
        signalingSubjects.wsAutoConnect.next(true)
        connectorSubjects.pairingStateSubject.next('paired')
      } else {
        signalingSubjects.wsGenerateConnectionSecretsSubject.next()
        connectorSubjects.pairingStateSubject.next('notPaired')
      }
    })
  }

  init()

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
    sendMessage,
    generateConnectionPassword: () =>
      signaling.subjects.wsRegenerateConnectionPassword.next(),
    setConnectionPassword,
    connect: () => connect(true),
    disconnect: () => connect(false),

    message$: webRtc.subjects.rtcIncomingMessageSubject
      .asObservable()
      .pipe(map(parseJSON)),
    connectionStatus$: webRtc.subjects.rtcStatusSubject.asObservable(),
    pairingState$: connectorSubjects.pairingStateSubject.asObservable(),
  }
}
