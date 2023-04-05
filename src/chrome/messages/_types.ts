import { err, ok, Result } from 'neverthrow'

export const messageDiscriminator = {
  getConnectionPassword: 'getConnectionPassword',
  connectionPasswordChange: 'connectionPasswordChange',
  dAppRequest: 'dAppRequest',
  ledgerResponse: 'ledgerResponse',
  walletRequest: 'walletRequest',
  walletResponse: 'walletResponse',
  sendMessageToTab: 'sendMessageToTab',
  detectWalletLink: 'detectWalletLink',
} as const

export type MessageDiscriminator = typeof messageDiscriminator

export const messageTarget = {
  offScreen: 'offScreen',
  background: 'background',
  contentScript: 'contentScript',
} as const

export type MessageTarget = keyof typeof messageTarget

export type MessageBuilder<
  D extends keyof typeof messageDiscriminator,
  Target extends MessageTarget,
  Payload
> = {
  target: Target
  discriminator: D
  messageId: string
} & Payload

export type OffScreenMessages = {
  [messageDiscriminator.connectionPasswordChange]: MessageBuilder<
    MessageDiscriminator['connectionPasswordChange'],
    'offScreen',
    { connectionPassword?: string }
  >
  [messageDiscriminator.dAppRequest]: MessageBuilder<
    MessageDiscriminator['dAppRequest'],
    'offScreen',
    { data: Record<string, any> }
  >
  [messageDiscriminator.walletResponse]: MessageBuilder<
    MessageDiscriminator['walletResponse'],
    'contentScript',
    { data: Record<string, any> }
  >
}

export type ContentScriptMessages = {
  [messageDiscriminator.walletResponse]: MessageBuilder<
    MessageDiscriminator['walletResponse'],
    'contentScript',
    { data: Record<string, any> }
  >
}

export type BackgroundMessages = {
  [messageDiscriminator.getConnectionPassword]: MessageBuilder<
    MessageDiscriminator['getConnectionPassword'],
    'background',
    {}
  >
  [messageDiscriminator.getConnectionPassword]: MessageBuilder<
    MessageDiscriminator['getConnectionPassword'],
    'background',
    {}
  >
  [messageDiscriminator.sendMessageToTab]: MessageBuilder<
    MessageDiscriminator['sendMessageToTab'],
    'background',
    { data: any; tabId: number }
  >
  [messageDiscriminator.detectWalletLink]: MessageBuilder<
    MessageDiscriminator['detectWalletLink'],
    'background',
    {}
  >
}

export type Messages = OffScreenMessages & BackgroundMessages

export type Message = Messages[keyof Messages]
export type OffScreenMessage = Messages[keyof OffScreenMessages]
export type BackgroundMessage = Messages[keyof BackgroundMessages]
export type ContentScriptMessage = Messages[keyof ContentScriptMessages]

export const isOffScreenMessage = (
  message: any
): Result<OffScreenMessages, undefined> =>
  message.target === messageTarget.offScreen ? ok(message) : err(undefined)

export const isBackgroundMessage = (
  message: any
): Result<BackgroundMessages, undefined> =>
  message.target === messageTarget.background ? ok(message) : err(undefined)

export const isContentScriptMessage = (
  message: any
): Result<Message, undefined> =>
  message.target === messageTarget.contentScript ? ok(message) : err(undefined)
