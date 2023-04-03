export const isOffscreenReady = (message?: any) =>
  message?.discriminator === 'offscreenDocumentReady'

export const offscreenReadyMessage = { discriminator: 'offscreenDocumentReady' }
