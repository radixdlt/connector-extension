export const config = {
  environment: process.env.NODE_ENV,
  ws: 'wss://signaling-server-pr-9.rdx-works-main.extratools.works',
  iceServers: [
    {
      urls: 'stun:stun.stunprotocol.org',
    },
    {
      urls: 'turn:signaling-server-pr-12.rdx-works-main.extratools.works:80',
      username: 'username',
      credential: 'password',
    },
  ],
  signalingServer: {
    reconnect: {
      interval: 1000,
    },
  },
}
