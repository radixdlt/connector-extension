import { MessageLifeCycleEvent, dAppEvent } from 'chrome/dapp/_types'
import { ok } from 'neverthrow'

export type ChromeDAppClient = ReturnType<typeof ChromeDAppClient>
export const ChromeDAppClient = () => {
  const sendMessage = (message: Record<string, any>) => {
    window.dispatchEvent(
      new CustomEvent(dAppEvent.receive, {
        detail: message,
      }),
    )
    return ok(true)
  }

  const sendMessageEvent = (
    interactionId: string,
    eventType: MessageLifeCycleEvent,
  ) =>
    sendMessage({
      interactionId,
      eventType,
    })

  const messageListener = (
    callbackFn: (message: Record<string, any>) => void,
  ) => {
    window.addEventListener(dAppEvent.send, (event) => {
      const { detail: message } = event as CustomEvent<any>
      callbackFn(message)
    })
  }

  return { sendMessage, messageListener, sendMessageEvent }
}
