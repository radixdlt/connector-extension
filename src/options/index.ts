import {
  RadixNetwork,
  RadixNetworkConfig,
} from '@radixdlt/babylon-gateway-api-sdk'
import { chromeStorageSync } from 'chrome/helpers/chrome-storage-sync'

export type ConnectorExtensionOptions = {
  networkId?: number
  dashboardBaseUrl?: string
  gatewayApiBaseUrl?: string
  showDAppRequestNotifications?: boolean
  showTransactionResultNotifications?: boolean
}

export const defaultConnectorExtensionOptions: ConnectorExtensionOptions = {
  networkId: RadixNetwork.Enkinet,
  dashboardBaseUrl: RadixNetworkConfig.Enkinet?.dashboardUrl || '',
  gatewayApiBaseUrl: RadixNetworkConfig.Enkinet?.gatewayUrl,
  showDAppRequestNotifications: true,
  showTransactionResultNotifications: true,
}

export const getSingleOptionValue = (key: keyof ConnectorExtensionOptions) =>
  chromeStorageSync
    .getSingleItem('options')
    .map((options) => options?.[key] || defaultConnectorExtensionOptions[key])
    .mapErr(() => defaultConnectorExtensionOptions[key])

export const getGatewayApiBaseUrl = () =>
  getSingleOptionValue('gatewayApiBaseUrl')

export const getShowDAppRequestNotifications = () =>
  getSingleOptionValue('showDAppRequestNotifications')

export const getShowTransactionResultNotifications = () =>
  getSingleOptionValue('showTransactionResultNotifications')

export const getNetworkId = () => getSingleOptionValue('networkId')

export const getDashboardBaseUrl = () =>
  getSingleOptionValue('dashboardBaseUrl')

export const getExtensionOptions = () => {
  return chromeStorageSync
    .getSingleItem('options')
    .map((options) => ({
      ...defaultConnectorExtensionOptions,
      ...options,
    }))
    .mapErr(() => defaultConnectorExtensionOptions)
}
