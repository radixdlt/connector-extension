import { Messages, messageTarget } from './_types'

export const createMessage = {
  connectionPasswordChange: (
    connectionPassword?: string
  ): Messages['connectionPasswordChange'] => ({
    discriminator: 'connectionPasswordChange',
    messageId: crypto.randomUUID(),
    target: messageTarget.offScreen,
    connectionPassword,
  }),
  getConnectionPassword: (): Messages['getConnectionPassword'] => ({
    discriminator: 'getConnectionPassword',
    messageId: crypto.randomUUID(),
    target: messageTarget.background,
  }),
  detectWalletLink: (): Messages['detectWalletLink'] => ({
    discriminator: 'detectWalletLink',
    messageId: crypto.randomUUID(),
    target: messageTarget.background,
  }),
  dAppRequest: (message: any): Messages['dAppRequest'] => ({
    discriminator: 'dAppRequest',
    messageId: crypto.randomUUID(),
    target: messageTarget.offScreen,
    data: message,
  }),
  walletResponse: (message: any): Messages['walletResponse'] => ({
    discriminator: 'walletResponse',
    messageId: crypto.randomUUID(),
    target: messageTarget.contentScript,
    data: message,
  }),
  sendMessageToTab: (
    tabId: number,
    data: any
  ): Messages['sendMessageToTab'] => ({
    discriminator: 'sendMessageToTab',
    messageId: crypto.randomUUID(),
    target: messageTarget.background,
    data,
    tabId,
  }),
} as const
