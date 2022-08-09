import { Buffer } from 'buffer'
window.Buffer = Buffer
import { config } from 'config'
import { SubjectsType, WebRtcClient } from 'connections'
import log from 'loglevel'

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

  window.webRtcClient = webRtcClient

  return { webRtcClient }
}
