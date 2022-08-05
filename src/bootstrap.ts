import { Buffer } from 'buffer'
window.Buffer = Buffer
import { config } from 'config'
import { subjects } from 'connections'
import {
  messageHandler,
  signalingServerClient,
} from 'connections/signaling-server-client'
import { WebRTC } from 'connections/webrtc'
import log from 'loglevel'

log.setLevel('debug')

declare global {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface Window {
    setLogLevel: (level: log.LogLevelDesc) => void
  }
}

window.setLogLevel = (level: log.LogLevelDesc) => log.setLevel(level)

const webrtc = WebRTC({
  subjects,
  peerConnectionConfig: config.webRTC.peerConnectionConfig,
  dataChannelConfig: config.webRTC.dataChannelConfig,
})
webrtc.createPeerConnectionAndDataChannel()
signalingServerClient({ url: config.signalingServer.baseUrl, subjects })
messageHandler(subjects)
subjects.wsGenerateConnectionSecretsSubject.next()
