import { ok } from 'neverthrow'

const dAppEvent = {
  receive: 'radix#chromeExtension#receive',
  send: 'radix#chromeExtension#send',
} as const

export const messageLifeCycleEvent = {
  receivedByExtension: 'receivedByExtension',
} as const

export const ChromeDAppClient = () => {
  const sendMessage = (message: Record<string, any>) => {
    window.dispatchEvent(
      new CustomEvent(dAppEvent.receive, {
        detail: message,
      })
    )
    return ok(true)
  }

  const sendMessageEvent = (
    requestId: string,
    eventType: keyof typeof messageLifeCycleEvent
  ) =>
    sendMessage({
      requestId,
      eventType,
    })

  const messageListener = (
    callbackFn: (message: Record<string, any>) => void
  ) => {
    window.addEventListener(dAppEvent.send, (event) => {
      const { detail: message } = event as CustomEvent<any>
      callbackFn(message)
    })
  }

  return { sendMessage, messageListener, sendMessageEvent }
}
