export const addOriginToWalletInteraction = <
  T extends { metadata: { origin?: string } },
>(
  message: T,
): T => ({
  ...message,
  metadata: {
    ...(message.metadata || {}),
    origin: window.location.origin,
  },
})
