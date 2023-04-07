export const addMetadata = (
  message: Record<string, any>
): Record<string, any> => ({
  ...message,
  metadata: {
    ...(message.metadata || {}),
    origin: window.location.origin,
  },
})
