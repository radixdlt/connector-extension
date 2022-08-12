import { Buffer } from 'buffer'
window.Buffer = Buffer
import { config } from 'config'
import { SubjectsType, WebRtcClient } from 'connections'
import log from 'loglevel'
import { storageSubjects } from 'storage/subjects'
import { StorageClient } from './storage/storage-client'

declare global {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface Window {
    setLogLevel: (level: log.LogLevelDesc) => void
    webRtcClient: ReturnType<typeof WebRtcClient>
  }
}

window.setLogLevel = (level: log.LogLevelDesc) => log.setLevel(level)

export const bootstrapApplication = (subjects: SubjectsType) => {
  log.setLevel(config.logLevel)

  log.info(
    `🏃‍♂️ running in: '${process.env.NODE_ENV}' mode, logLevel: '${config.logLevel}'`
  )

  const webRtcClient = WebRtcClient({
    subjects,
    webRtcOptions: {
      peerConnectionConfig: config.webRTC.peerConnectionConfig,
      dataChannelConfig: config.webRTC.dataChannelConfig,
    },
    signalingServerOptions: {
      baseUrl: config.signalingServer.baseUrl,
    },
  })

  const storageClient = StorageClient('radix', storageSubjects)

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

  return { webRtcClient, storageClient }
}
