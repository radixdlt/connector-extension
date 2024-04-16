import { chromeLocalStore } from 'chrome/helpers/chrome-local-store'
import { logger } from 'utils/logger'
import { defaultRadixConnectConfig } from 'config'
import { ResultAsync } from 'neverthrow'
import { ed25519 } from '@noble/curves/ed25519'

const privateKey = ed25519.utils.randomPrivateKey()
const publicKey = ed25519.getPublicKey(privateKey)

export type ConnectorExtensionOptions = {
  publicKey: string
  privateKey: string
  showDAppRequestNotifications?: boolean
  showTransactionResultNotifications?: boolean
  radixConnectConfiguration: string
}

export const defaultConnectorExtensionOptions: ConnectorExtensionOptions = {
  publicKey: Buffer.from(publicKey).toString('hex'),
  privateKey: Buffer.from(privateKey).toString('hex'),
  showDAppRequestNotifications: true,
  showTransactionResultNotifications: true,
  radixConnectConfiguration: defaultRadixConnectConfig,
}

export const getSingleOptionValue = (key: keyof ConnectorExtensionOptions) =>
  chromeLocalStore
    .getSingleItem('options')
    .map((options) => options?.[key] || defaultConnectorExtensionOptions[key])
    .mapErr(() => defaultConnectorExtensionOptions[key])

export const getShowDAppRequestNotifications = () =>
  getSingleOptionValue('showDAppRequestNotifications')

export const getShowTransactionResultNotifications = () =>
  getSingleOptionValue('showTransactionResultNotifications')

export const getExtensionOptions = (): ResultAsync<
  ConnectorExtensionOptions,
  ConnectorExtensionOptions
> => {
  return chromeLocalStore
    .getSingleItem('options')
    .map((options) => ({
      ...defaultConnectorExtensionOptions,
      ...options,
    }))
    .mapErr(() => defaultConnectorExtensionOptions)
}

export const setConnectorExtensionOptions = (
  connectorExtensionOptions: ConnectorExtensionOptions,
) => {
  logger.debug('setConnectorExtensionOptions', connectorExtensionOptions)
  return chromeLocalStore.setSingleItem('options', connectorExtensionOptions)
}
