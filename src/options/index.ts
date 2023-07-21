import { chromeStorageSync } from 'chrome/helpers/chrome-storage-sync'

export type ConnectorExtensionOptions = {
  showDAppRequestNotifications?: boolean
  showTransactionResultNotifications?: boolean
}

export const defaultConnectorExtensionOptions: ConnectorExtensionOptions = {
  showDAppRequestNotifications: true,
  showTransactionResultNotifications: true,
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
