import { dAppEvent } from 'chrome/dapp/_types'

export const handleOutboundMessage = async (message: any) => {
  if (message.type === 'sendMessageToDapp')
    window.dispatchEvent(
      new CustomEvent(dAppEvent.receive, {
        detail: message.data,
      }),
    )
}
