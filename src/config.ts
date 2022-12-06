import { LogLevelDesc } from 'loglevel'
import packageJson from '../package.json'
const { version } = packageJson

export const config = {
  environment: process.env.NODE_ENV,
  logLevel: import.meta.env.VITE_APP_LOG_LEVEL as LogLevelDesc,
  version,
  secrets: {
    connectionPasswordByteLength: 32,
  },
  storage: { key: 'radix' },
  signalingServer: {
    baseUrl: import.meta.env.VITE_APP_SIGNALING_SERVER_BASE_URL,
    reconnect: {
      interval: 1000,
    },
    useBatchedIceCandidates: true,
    iceCandidatesBatchTime: 400,
  },
  webRTC: {
    peerConnectionConfig: {
      iceServers: [
        {
          urls: 'stun:stun.stunprotocol.org',
        },
        {
          urls: 'turn:turn-dev-tcp.rdx-works-main.extratools.works:80',
          username: 'username',
          credential: 'password',
        },
        {
          urls: 'turn:turn-dev-udp.rdx-works-main.extratools.works:80',
          username: 'username',
          credential: 'password',
        },
      ],
    },
    dataChannelConfig: {
      negotiated: true,
      id: 0,
      ordered: true,
    },
    chunkSize: 11_500,
    confirmationTimeout: 3_000,
  },
  popup: {
    width: 375,
    height: 559,
    offsetTop: 0,
    pages: {
      pairing: 'src/pairing/index.html',
      devTools: 'src/chrome/dev-tools/dev-tools.html',
    },
    closeDelayTime: 700,
    showOnInstall: false,
  },
}
