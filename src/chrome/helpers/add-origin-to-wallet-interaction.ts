import {
  WalletInteraction,
  WalletInteractionWithOrigin,
} from '@radixdlt/radix-dapp-toolkit'

export const addOriginToWalletInteraction = (
  message: WalletInteraction,
): WalletInteractionWithOrigin => ({
  ...message,
  metadata: {
    ...(message.metadata || {}),
    origin: window.location.origin,
  },
})
