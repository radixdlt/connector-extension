import type { MessageLifeCycleEvent } from 'chrome/dapp/_types'
import { dAppEvent } from 'chrome/dapp/_types'
import { ok } from 'neverthrow'

import type { AppLogger } from 'utils/logger'
import { addOriginToWalletInteraction } from 'chrome/helpers/add-origin-to-wallet-interaction'
import { safeParse } from 'valibot'
import type {
  WalletInteraction,
  ExtensionInteraction,
} from '@radixdlt/radix-dapp-toolkit'
import {
  ExtenstionInteractionOptionalOrigin,
  WalletInteractionWithOptionalOrigin,
} from './schemas'

/**
 * A message from the dApp's page, as it comes: nothing about it is checked yet, but
 * these fields are read before it is.
 */
type DappEventDetail = Record<string, unknown> & {
  interactionId?: string
  sessionId?: string
  discriminator?: string
}

export type ChromeDAppClient = ReturnType<typeof ChromeDAppClient>
export const ChromeDAppClient = (logger: AppLogger) => {
  const sendMessage = (message: Record<string, unknown>) => {
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
      const message = ((event as CustomEvent<unknown>).detail ??
        {}) as DappEventDetail

      if (message.interactionId)
        sendMessageEvent(message.interactionId, 'receivedByExtension')

      // For RDT >= 1.6.0; this includes WalletInteraction
      if (safeParse(ExtenstionInteractionOptionalOrigin, message).success)
        return onExtensionRequest(message as ExtensionInteraction)

      // For RDT < 1.6.0
      if (safeParse(WalletInteractionWithOptionalOrigin, message).success)
        return onDappRequest(
          addOriginToWalletInteraction(message as WalletInteraction),
        )

      // openPopup is a special case, as it is missing interactionId in older walletSDK versions
      const isOpenPopupRequest =
        message.discriminator === 'openPopup' && !message.interactionId

      if (isOpenPopupRequest)
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- an old openPopup lacks fields the type has
        return onExtensionRequest({
          ...message,
          interactionId: crypto.randomUUID(),
        } as ExtensionInteraction)

      if (message.sessionId) {
        logger.warn({ reason: 'UnrecognizedExtensionRequest', message })
        // Passed on unchecked, as it always was: the offscreen document checks it.
        return onExtensionRequest(message as unknown as ExtensionInteraction)
      }

      if (message.interactionId) {
        logger.warn({ reason: 'UnrecognizedDappRequest', message })
        return onDappRequest(
          addOriginToWalletInteraction(message as unknown as WalletInteraction),
        )
      }
    })
  }

  return { sendMessage, messageListener, sendMessageEvent }
}
