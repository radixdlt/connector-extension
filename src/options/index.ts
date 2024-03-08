import { chromeLocalStore } from 'chrome/helpers/chrome-local-store'
import { logger } from 'utils/logger'
import { defaultRadixConnectConfig } from 'config'
import { ResultAsync } from 'neverthrow'

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
  chromeLocalStore.setSingleItem('options', connectorExtensionOptions)
}
