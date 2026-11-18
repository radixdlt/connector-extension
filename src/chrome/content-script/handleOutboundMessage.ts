import { dAppEvent } from 'chrome/dapp/_types'

/** What the background sends a content script for its dApp's page. */
type MessageForDapp = { type?: unknown; data?: unknown }

export const handleOutboundMessage = async (message: MessageForDapp) => {
  if (message?.type === 'sendMessageToDapp')
    window.dispatchEvent(
      new CustomEvent(dAppEvent.receive, {
        detail: message.data,
      }),
    )
}
