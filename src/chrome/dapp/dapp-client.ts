import { MessageLifeCycleEvent, dAppEvent } from 'chrome/dapp/_types'
import { ok } from 'neverthrow'
import {
  WalletInteractionWithOrigin,
  WalletInteraction,
  ExtensionInteraction,
} from '@radixdlt/radix-connect-schemas'
import { AppLogger } from 'utils/logger'
import { addOriginToWalletInteraction } from 'chrome/helpers/add-origin-to-wallet-interaction'

export type ChromeDAppClient = ReturnType<typeof ChromeDAppClient>
export const ChromeDAppClient = (logger: AppLogger) => {
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
    onDappRequest: (message: WalletInteractionWithOrigin) => void,
    onExtensionRequest: (message: ExtensionInteraction) => void,
  ) => {
    window.addEventListener(dAppEvent.send, (event) => {
      const { detail: message } = event as CustomEvent<any>

      if (message.interactionId)
        sendMessageEvent(message.interactionId, 'receivedByExtension')

      const dAppInteractionResult = WalletInteraction.safeParse(message)

      if (dAppInteractionResult.success)
        return onDappRequest(
          addOriginToWalletInteraction(dAppInteractionResult.data),
        )

      const extensionInteractionResult = ExtensionInteraction.safeParse(message)

      if (extensionInteractionResult.success)
        return onExtensionRequest(extensionInteractionResult.data)

      // openPopup is a special case, as it is missing interactionId in older walletSDK versions
      const isOpenPopupRequest =
        (message as ExtensionInteraction).discriminator === 'openPopup' &&
        !message.interactionId

      if (isOpenPopupRequest)
        return onExtensionRequest({
          ...message,
          interactionId: crypto.randomUUID(),
        } as ExtensionInteraction)

      if (message.interactionId)
        sendMessage({
          interactionId: message.interactionId,
          discriminator: 'failure',
          error: 'InvalidDappRequest',
        })

      logger.error({ reason: 'InvalidDappRequest', message })
    })
  }

  return { sendMessage, messageListener, sendMessageEvent }
}
