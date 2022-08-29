import { Buffer } from 'buffer'
import { config } from 'config'
import {
  WebRtcSubjectsType,
  WebRtcClient,
  WebRtcClientInput,
  WebRtcSubjects,
  SignalingServerClientInput,
} from 'connections'
import log from 'loglevel'
import { MessageClient } from 'messages/message-client'
import { MessageSubjects, MessageSubjectsType } from 'messages/subjects'
import { StorageSubjects, StorageSubjectsType } from 'storage/subjects'
import { StorageClient } from './storage/storage-client'

declare global {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface Window {
    setLogLevel: (level: log.LogLevelDesc) => void
    webRtcClient: ReturnType<typeof WebRtcClient>
  }
}

window.setLogLevel = (level: log.LogLevelDesc) => log.setLevel(level)

export type BootstrapApplicationType = ReturnType<typeof BootstrapApplication>

export const BootstrapApplication = ({
  webRtcSubjects = WebRtcSubjects(),
  webRtcClientOptions = {
    webRtcOptions: {
      peerConnectionConfig: config.webRTC.peerConnectionConfig,
      dataChannelConfig: config.webRTC.dataChannelConfig,
    },
  },
  signalingServerOptions = {
    baseUrl: config.signalingServer.baseUrl,
  },
  messageSubjects = MessageSubjects(),
  storageSubjects = StorageSubjects(),
}: Partial<{
  webRtcSubjects: WebRtcSubjectsType
  webRtcClientOptions: Omit<
    WebRtcClientInput,
    'signalingServerOptions' | 'subjects'
  >
  signalingServerOptions: Omit<SignalingServerClientInput, 'subjects'>
  messageSubjects: MessageSubjectsType
  storageSubjects: StorageSubjectsType
}>) => {
  log.setLevel(config.logLevel)

  log.info(
    `🏃‍♂️ running in: '${process.env.NODE_ENV}' mode, logLevel: '${config.logLevel}'`
  )

  const webRtcClient = WebRtcClient({
    ...webRtcClientOptions,
    subjects: webRtcSubjects,
    signalingServerOptions,
  })

  const storageClient = StorageClient('radix', storageSubjects)

  const messageClient = MessageClient(messageSubjects, webRtcSubjects)

  storageClient
    .getConnectionPassword()
    .map((connectionPassword) => {
      if (connectionPassword) {
        log.debug(
          `🔑 found connection password in storage: ${connectionPassword}`
        )
        webRtcClient.subjects.wsConnectionPasswordSubject.next(
          Buffer.from(connectionPassword, 'hex')
        )
        webRtcClient.subjects.wsAutoConnect.next(true)
      } else {
        log.debug(
          `🔑 did not find connection password in storage, generating new password`
        )
        webRtcClient.subjects.wsGenerateConnectionSecretsSubject.next()
      }
      return undefined
    })
    .mapErr(log.error)

  webRtcClient.subjects.rtcConnectSubject.next(true)

  window.webRtcClient = webRtcClient

  const destroy = () => {
    webRtcClient.destroy()
    storageClient.destroy()
    messageClient.destroy()
  }

  webRtcSubjects.wsAutoConnect.next(true)

  return { webRtcClient, storageClient, messageClient, destroy }
}
