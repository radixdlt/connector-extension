import { Buffer } from 'buffer'
window.Buffer = Buffer
import { config } from 'config'
import { SubjectsType, WebRtcClient } from 'connections'
import log from 'loglevel'

declare global {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface Window {
    setLogLevel: (level: log.LogLevelDesc) => void
  }
}

window.setLogLevel = (level: log.LogLevelDesc) => log.setLevel(level)

export const bootstrapApplication = (subjects: SubjectsType) => {
  log.setLevel('debug')

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

  webRtcClient.subjects.wsGenerateConnectionSecretsSubject.next()
  webRtcClient.subjects.rtcConnectSubject.next(true)

  return { webRtcClient }
}
