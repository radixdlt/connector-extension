import { LogLevelDesc } from 'loglevel'

export const config = {
  environment: process.env.NODE_ENV,
  logLevel: 'debug' as LogLevelDesc,
  signalingServer: {
    baseUrl: 'wss://signaling-server-pr-30.rdx-works-main.extratools.works',
    reconnect: {
      interval: 1000,
    },
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
}
