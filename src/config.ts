import { LogLevelNumbers } from 'loglevel'
import packageJson from '../package.json'
import './buffer-shim'
import { ConnectionConfig } from '@radixdlt/radix-connect-webrtc'
const { version } = packageJson

const developmentConfig: Required<ConnectionConfig> = {
  signalingServerBaseUrl:
    'wss://signaling-server-dev.rdx-works-main.extratools.works',
  turnServers: [
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
}

export const radixConnectConfig: Record<string, Required<ConnectionConfig>> = {
  production: {
    signalingServerBaseUrl: 'wss://signaling-server.radixdlt.com',
    turnServers: [
      {
        urls: 'turn:turn-udp.radixdlt.com:80?transport=udp',
        username: 'username',
        credential: 'password',
      },
      {
        urls: 'turn:turn-tcp.radixdlt.com:80?transport=tcp',
        username: 'username',
        credential: 'password',
      },
    ],
  },
  development: developmentConfig,
  test: developmentConfig,
}

export const mode = import.meta.env.MODE as
  | 'production'
  | 'development'
  | 'test'

const githubRefName = import.meta.env.VITE_GITHUB_REF_NAME || ''

export const isPublicRelease =
  githubRefName === 'main' || githubRefName.includes('release/')

export const defaultRadixConnectConfig = isPublicRelease
  ? 'production'
  : 'development'

export const defaultConnectionConfig: ConnectionConfig = {
  turnServers: radixConnectConfig[defaultRadixConnectConfig].turnServers,
  signalingServerBaseUrl:
    import.meta.env.VITE_APP_SIGNALING_SERVER_BASE_URL ||
    radixConnectConfig[defaultRadixConnectConfig].signalingServerBaseUrl,
}

export const config = {
  environment: process.env.NODE_ENV,
  logLevel: (import.meta.env.VITE_APP_LOG_LEVEL || 0) as LogLevelNumbers,
  version,
  secrets: {
    connectionPasswordByteLength: 32,
  },
  storage: { key: 'radix' },
  offscreen: {
    url: 'src/chrome/offscreen/index.html',
  },
  webRTC: {
    isInitiator: true,
    confirmationTimeout: 10_000,
  },
  devTools: {
    url: 'src/chrome/dev-tools/dev-tools.html',
  },
  popup: {
    width: 400,
    height: 600,
    offsetTop: 0,
    pages: {
      pairing: 'src/pairing/index.html',
      ledger: 'src/ledger/index.html',
    },
    closeDelayTime: 700,
  },
}
