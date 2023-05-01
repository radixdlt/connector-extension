import { LogLevelNumbers } from 'loglevel'
import packageJson from '../package.json'
import './buffer-shim'
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
  rcnet: [
    {
      urls: 'turn:turn-rcnet-udp.radixdlt.com:80?transport=udp',
      username: 'username',
      credential: 'password',
    },
    {
      urls: 'turn:turn-rcnet-tcp.radixdlt.com:80?transport=tcp',
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
} as const

const mode = import.meta.env.MODE as 'test' | 'development' | 'rcnet'

export const config = {
  environment: process.env.NODE_ENV,
  logLevel: import.meta.env.VITE_APP_LOG_LEVEL as LogLevelNumbers,
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
    useBatchedIceCandidates: false,
    iceCandidatesBatchTime: 2000,
    useTargetClientId: import.meta.env.VITE_APP_USE_TARGET_CLIENT_ID === 'true',
  },
  offscreen: {
    url: 'src/chrome/offscreen/index.html',
  },
  webRTC: {
    isInitiator: import.meta.env.VITE_APP_IS_INITIATOR === 'true',
    disconnectOnVisibilityChange: false,
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
    confirmationTimeout: 10_000,
  },
  devTools: {
    url: 'src/chrome/dev-tools/dev-tools.html',
  },
  popup: {
    width: 375,
    height: 559,
    offsetTop: 0,
    pages: {
      pairing: 'src/pairing/index.html',
      ledger: 'src/ledger/index.html',
    },
    closeDelayTime: 700,
    showOnInstall: false,
  },
}
