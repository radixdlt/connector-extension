import { MessageLifeCycleEvent, dAppEvent } from 'chrome/dapp/_types'
import { ok } from 'neverthrow'

import { AppLogger } from 'utils/logger'
import { addOriginToWalletInteraction } from 'chrome/helpers/add-origin-to-wallet-interaction'
import { safeParse } from 'valibot'
import {
  WalletInteraction,
  ExtensionInteraction,
} from '@radixdlt/radix-dapp-toolkit'
import {
  ExtenstionInteractionOptionalOrigin,
  WalletInteractionWithOptionalOrigin,
} from './schemas'

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
    onDappRequest: (message: WalletInteraction) => void,
    onExtensionRequest: (message: ExtensionInteraction) => void,
  ) => {
    window.addEventListener(dAppEvent.send, (event) => {
      const { detail: message } = event as CustomEvent<any>

      if (message.interactionId)
        sendMessageEvent(message.interactionId, 'receivedByExtension')

      // For RDT >= 1.6.0; this includes WalletInteraction
      if (safeParse(ExtenstionInteractionOptionalOrigin, message).success)
        return onExtensionRequest(message)

      // For RDT < 1.6.0
      if (safeParse(WalletInteractionWithOptionalOrigin, message).success)
        return onDappRequest(addOriginToWalletInteraction(message))

      // openPopup is a special case, as it is missing interactionId in older walletSDK versions
      const isOpenPopupRequest =
        (message as ExtensionInteraction).discriminator === 'openPopup' &&
        !message.interactionId

      if (isOpenPopupRequest)
        return onExtensionRequest({
          ...message,
          interactionId: crypto.randomUUID(),
        } as ExtensionInteraction)

      if (message.sessionId) {
        logger.warn({ reason: 'UnrecognizedExtensionRequest', message })
        return onExtensionRequest(message)
      }

      if (message.interactionId) {
        logger.warn({ reason: 'UnrecognizedDappRequest', message })
        return onDappRequest(addOriginToWalletInteraction(message))
      }
    })
  }

  return { sendMessage, messageListener, sendMessageEvent }
}
