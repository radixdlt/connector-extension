import { ok } from 'neverthrow'

const dAppEvent = {
  receive: 'radix#chromeExtension#receive',
  send: 'radix#chromeExtension#send',
} as const

export const chromeDAppClient = {
  sendMessage: (message: Record<string, any>) => {
    window.dispatchEvent(
      new CustomEvent(dAppEvent.receive, {
        detail: message,
      })
    )
    return ok(true)
  },
  messageListener: (callbackFn: (message: Record<string, any>) => void) => {
    window.addEventListener(dAppEvent.send, (event) => {
      const { detail: message } = event as CustomEvent<any>
      callbackFn(message)
    })
  },
} as const
