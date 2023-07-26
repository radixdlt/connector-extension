export const dAppEvent = {
  receive: 'radix#chromeExtension#receive',
  send: 'radix#chromeExtension#send',
} as const

export type DappEventType = keyof typeof dAppEvent

export const messageLifeCycleEvent = {
  receivedByExtension: 'receivedByExtension',
  receivedByWallet: 'receivedByWallet',
  requestCancelSuccess: 'requestCancelSuccess',
  requestCancelFail: 'requestCancelFail',
} as const

export type MessageLifeCycleEvent = keyof typeof messageLifeCycleEvent
