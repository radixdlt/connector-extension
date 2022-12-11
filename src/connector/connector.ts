import log, { LogLevelDesc } from 'loglevel'
import {
  SignalingServerClient,
  SignalingServerClientType,
} from 'connector/signaling/signaling-server-client'
import { StorageClient, StorageClientType } from './storage/storage-client'
import { ConnectorSubscriptions } from './subscriptions'
import { WebRtcClient, WebRtcClientType } from 'connector/webrtc/webrtc-client'
import { map } from 'rxjs/operators'
import { parseJSON } from 'utils'
import { ConnectorSubjects, ConnectorSubjectsType } from './subjects'
import { Buffer } from 'buffer'
import { config } from 'config'

export type ConnectorType = ReturnType<typeof Connector>

export type ConnectorInput = {
  id?: string
  logger?: log.Logger
  connectorSubjects?: ConnectorSubjectsType
  signalingServerClient?: SignalingServerClientType
  webRtcClient?: WebRtcClientType
  storageClient?: StorageClientType
  logLevel?: LogLevelDesc
  generateConnectionPassword?: boolean
}

export const Connector = ({
  id = crypto.randomUUID(),
  logLevel = config.logLevel,
  logger = log,
  connectorSubjects = ConnectorSubjects(),
  signalingServerClient = SignalingServerClient({
    logger: log.getLogger(`${id}-signalingServerClient`),
  }),
  webRtcClient = WebRtcClient({ logger: log.getLogger(`${id}-webRtcClient`) }),
  storageClient = StorageClient({
    logger: log.getLogger(`${id}-storageClient`),
  }),
  generateConnectionPassword = true,
}: ConnectorInput) => {
  logger.setLevel(logLevel)
  logger.debug(
    `🏃‍♂️ connector extension running in: '${process.env.NODE_ENV}' mode`
  )

  const connectorSubscriptions = ConnectorSubscriptions({
    webRtcClient,
    storageClient,
    signalingServerClient,
    connectorSubjects,
    logger,
  })

  const connect = (value: boolean) => {
    signalingServerClient.connect(value)
    webRtcClient.connect(value)
  }

  const init = () => {
    storageClient.getConnectionPassword().map((connectionPassword) => {
      if (connectionPassword) {
        logger.debug(`🔐 setting connectionPassword`)
        signalingServerClient.subjects.wsConnectionPasswordSubject.next(
          Buffer.from(connectionPassword, 'hex')
        )
        signalingServerClient.subjects.wsAutoConnect.next(true)
        connectorSubjects.pairingStateSubject.next('paired')
      } else {
        if (generateConnectionPassword) {
          signalingServerClient.subjects.wsGenerateConnectionSecretsSubject.next()
        }
        connectorSubjects.pairingStateSubject.next('notPaired')
      }
    })
  }

  init()

  const destroy = () => {
    webRtcClient.destroy()
    signalingServerClient.destroy()
    storageClient.destroy()
    connectorSubscriptions.unsubscribe()
  }

  return {
    webRtcClient,
    signalingServerClient,
    storageClient,
    destroy,
    logger,
    sendMessage: (message: Record<string, any>) => {
      webRtcClient.subjects.rtcAddMessageToQueue.next(message)
    },
    generateConnectionPassword: () =>
      signalingServerClient.subjects.wsRegenerateConnectionPassword.next(),
    setConnectionPassword: (password: string) => {
      signalingServerClient.subjects.wsConnectionPasswordSubject.next(
        Buffer.from(password, 'hex')
      )
    },
    connect: () => connect(true),
    disconnect: () => connect(false),
    getConnectionPassword: storageClient.getConnectionPassword,
    message$: webRtcClient.subjects.rtcIncomingMessageSubject
      .asObservable()
      .pipe(map(parseJSON)),
    connectionSecrets$:
      signalingServerClient.subjects.wsConnectionSecretsSubject.asObservable(),
    connectionStatus$: webRtcClient.subjects.rtcStatusSubject.asObservable(),
    pairingState$: connectorSubjects.pairingStateSubject.asObservable(),
  }
}
