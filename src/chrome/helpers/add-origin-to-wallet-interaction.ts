import {
  WalletInteraction,
  WalletInteractionWithOrigin,
} from '@radixdlt/radix-connect-schemas'

export const addOriginToWalletInteraction = (
  message: WalletInteraction,
): WalletInteractionWithOrigin => ({
  ...message,
  metadata: {
    ...(message.metadata || {}),
    origin: window.location.origin,
  },
})
