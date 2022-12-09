import { LogLevelDesc } from 'loglevel'
import packageJson from '../package.json'
const { version } = packageJson

const turnServers = {
  test: [
    {
      urls: 'turn:turn-dev-udp.rdx-works-main.extratools.works:80?transport=udp',
      username: 'username',
      credential: 'password',
    },
    {
      urls: 'turn:turn-dev-tcp.rdx-works-main.extratools.works:80?transport=tcp',
      username: 'username',
      credential: 'password',
    },
  ],
  development: [
    {
      urls: 'turn:turn-dev-udp.rdx-works-main.extratools.works:80?transport=udp',
      username: 'username',
      credential: 'password',
    },
    {
      urls: 'turn:turn-dev-tcp.rdx-works-main.extratools.works:80?transport=tcp',
      username: 'username',
      credential: 'password',
    },
  ],
  beta: [
    {
      urls: 'turn:turn-betanet-udp.radixdlt.com:80?transport=udp',
      username: 'username',
      credential: 'password',
    },
    {
      urls: 'turn:turn-betanet-tcp.radixdlt.com:80?transport=tcp',
      username: 'username',
      credential: 'password',
    },
  ],
} as const

const mode = import.meta.env.MODE as 'test' | 'development' | 'beta'

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
    iceCandidatesBatchTime: 2000,
  },
  webRTC: {
    peerConnectionConfig: {
      iceServers: [
        {
          urls: 'stun:stun.l.google.com:19302',
        },
        {
          urls: 'stun:stun1.l.google.com:19302',
        },
        {
          urls: 'stun:stun2.l.google.com:19302',
        },
        {
          urls: 'stun:stun3.l.google.com:19302',
        },
        {
          urls: 'stun:stun4.l.google.com:19302',
        },
        ...(turnServers[mode] || []),
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
    closeDelayTime: 0,
    showOnInstall: false,
  },
}
