import {
  CancelWalletInteractionExtensionInteraction,
  WalletInteraction,
} from '@radixdlt/radix-dapp-toolkit'
import {
  CancelWalletInteractionExtensionInteractionOptionalOrigin,
  WalletInteractionWithOptionalOrigin,
} from 'chrome/dapp/schemas'

export const addOriginToWalletInteraction = (
  message: WalletInteractionWithOptionalOrigin | WalletInteraction,
): WalletInteraction => ({
  ...message,
  metadata: {
    ...(message.metadata || {}),
    origin: window.location.origin,
  },
})

export const addOriginToCancelInteraction = (
  interaction:
    | CancelWalletInteractionExtensionInteractionOptionalOrigin
    | CancelWalletInteractionExtensionInteraction,
): CancelWalletInteractionExtensionInteraction => ({
  ...interaction,
  metadata: {
    ...(interaction.metadata || {}),
    origin: window.location.origin,
  },
})
