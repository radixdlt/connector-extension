import { chromeLocalStore } from 'chrome/helpers/chrome-local-store'
import { logger } from 'utils/logger'
import { defaultRadixConnectConfig } from 'config'
import { ResultAsync, ok } from 'neverthrow'
import { ed25519 } from '@noble/curves/ed25519'

const privateKey = ed25519.utils.randomPrivateKey()
const publicKey = ed25519.getPublicKey(privateKey)

export type ConnectorExtensionOptions = {
  publicKey: string
  privateKey: string
  radixConnectConfiguration: string
  showDAppRequestNotifications: boolean
  showTransactionResultNotifications: boolean
}

export const defaultConnectorExtensionOptions: ConnectorExtensionOptions = {
  publicKey: Buffer.from(publicKey).toString('hex'),
  privateKey: Buffer.from(privateKey).toString('hex'),
  showDAppRequestNotifications: true,
  showTransactionResultNotifications: true,
  radixConnectConfiguration: defaultRadixConnectConfig,
}

export const getSingleOptionValue = <T extends keyof ConnectorExtensionOptions>(
  key: T,
): ResultAsync<ConnectorExtensionOptions[T], never> =>
  chromeLocalStore
    .getSingleItem('options')
    .map((options) => options?.[key] || defaultConnectorExtensionOptions[key])
    .orElse(() => ok(defaultConnectorExtensionOptions[key]))

export const getShowDAppRequestNotifications = () =>
  getSingleOptionValue('showDAppRequestNotifications')

export const getShowTransactionResultNotifications = () =>
  getSingleOptionValue('showTransactionResultNotifications')

export const getExtensionOptions = (): ResultAsync<
  ConnectorExtensionOptions,
  never
> => {
  return chromeLocalStore
    .getSingleItem('options')
    .map((options) => ({
      ...defaultConnectorExtensionOptions,
      ...options,
    }))
    .orElse(() => ok(defaultConnectorExtensionOptions))
}

export const setConnectorExtensionOptions = (
  connectorExtensionOptions: ConnectorExtensionOptions,
) => {
  logger.debug('setConnectorExtensionOptions', connectorExtensionOptions)
  return chromeLocalStore.setSingleItem('options', connectorExtensionOptions)
}
