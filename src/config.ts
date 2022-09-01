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
    useBatchedIceCandidates: false,
    iceCandidatesBatchTime: 2000,
  },
  webRTC: {
    peerConnectionConfig: {
      iceServers: [
        {
          urls: 'stun:stun.stunprotocol.org',
        },
        {
          urls: 'turn:k8s-signalin-turnserv-46e371bfb0-ed89a06c3bcabcd8.elb.eu-west-2.amazonaws.com:80',
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
  mixpanel: { token: 'b85738f974413421c9aa247d1cc18150' },
}
