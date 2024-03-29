import { chromeStorageSync } from 'chrome/helpers/chrome-storage-sync'
import { logger } from 'utils/logger'
import { defaultRadixConnectConfig } from 'config'

export type ConnectorExtensionOptions = {
  showDAppRequestNotifications?: boolean
  showTransactionResultNotifications?: boolean
  radixConnectConfiguration: string
}

export const defaultConnectorExtensionOptions: ConnectorExtensionOptions = {
  showDAppRequestNotifications: true,
  showTransactionResultNotifications: true,
  radixConnectConfiguration: defaultRadixConnectConfig,
}

export const getSingleOptionValue = (key: keyof ConnectorExtensionOptions) =>
  chromeStorageSync
    .getSingleItem('options')
    .map((options) => options?.[key] || defaultConnectorExtensionOptions[key])
    .mapErr(() => defaultConnectorExtensionOptions[key])

export const getShowDAppRequestNotifications = () =>
  getSingleOptionValue('showDAppRequestNotifications')

export const getShowTransactionResultNotifications = () =>
  getSingleOptionValue('showTransactionResultNotifications')

export const getExtensionOptions = () => {
  return chromeStorageSync
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
  chromeStorageSync.setSingleItem('options', connectorExtensionOptions)
}
