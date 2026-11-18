import { localStore } from 'chrome/helpers/storage'
import { logger } from 'utils/logger'
import { defaultRadixConnectConfig } from 'config'
import type { ResultAsync } from 'neverthrow'
import { ok, okAsync } from 'neverthrow'
import { ed25519 } from '@noble/curves/ed25519'
import {
  defaultRadixConnectTransport,
  migrateIrohRelayUrl,
  type RadixConnectTransport,
} from './radix-connect-transport'
import {
  defaultPendingRequestExpiry,
  type PendingRequestExpiry,
} from 'chrome/offscreen/requests/pending-request'

export type ConnectorExtensionOptions = {
  publicKey: string
  privateKey: string
  radixConnectConfiguration: string
  customSignalingServerUrl?: string
  radixConnectTransport: RadixConnectTransport
  /** A custom iroh relay. Empty or missing: n0's public relays. */
  irohRelayUrl?: string
  showDAppRequestNotifications: boolean
  showTransactionResultNotifications: boolean
  /** When a pending request no wallet is answering is cancelled (see `expiredRequests`). */
  pendingRequestExpiry: PendingRequestExpiry
}

type KeyPair = Pick<ConnectorExtensionOptions, 'publicKey' | 'privateKey'>

/**
 * A new key pair for the extension, drawn the first time the options are read.
 * The curve is imported statically: the background service worker reads the
 * options too, and service workers cannot use import().
 */
const newKeyPair = (): ResultAsync<KeyPair, never> => {
  const privateKey = ed25519.utils.randomPrivateKey()
  return okAsync({
    privateKey: Buffer.from(privateKey).toString('hex'),
    publicKey: Buffer.from(ed25519.getPublicKey(privateKey)).toString('hex'),
  })
}

/** Every option but the extension's key pair, which has no default. */
export const defaultConnectorExtensionOptions: Omit<
  ConnectorExtensionOptions,
  keyof KeyPair
> = {
  showDAppRequestNotifications: true,
  showTransactionResultNotifications: true,
  pendingRequestExpiry: defaultPendingRequestExpiry,
  radixConnectConfiguration: defaultRadixConnectConfig,
  radixConnectTransport: defaultRadixConnectTransport,
}

export const getSingleOptionValue = <
  T extends keyof typeof defaultConnectorExtensionOptions,
>(
  key: T,
): ResultAsync<(typeof defaultConnectorExtensionOptions)[T], never> =>
  localStore
    .get('options')
    // `??`: a switched-off option (false) must not fall back to the default.
    .map((options) => options?.[key] ?? defaultConnectorExtensionOptions[key])
    .orElse(() => ok(defaultConnectorExtensionOptions[key]))

export const getShowDAppRequestNotifications = () =>
  getSingleOptionValue('showDAppRequestNotifications')

export const getShowTransactionResultNotifications = () =>
  getSingleOptionValue('showTransactionResultNotifications')

/**
 * The options as saved, with the defaults of missing ones. Without a saved key
 * pair (before the background saved the options at install), one is drawn and
 * saved, so that every page then uses the same.
 */
export const getExtensionOptions = (): ResultAsync<
  ConnectorExtensionOptions,
  never
> =>
  localStore
    .get('options')
    .orElse(() => ok(undefined))
    .andThen((stored) => {
      const options = {
        ...defaultConnectorExtensionOptions,
        ...stored,
        irohRelayUrl: migrateIrohRelayUrl(stored?.irohRelayUrl),
      }
      const { publicKey, privateKey } = stored ?? {}
      if (publicKey && privateKey)
        return ok<ConnectorExtensionOptions>({
          ...options,
          publicKey,
          privateKey,
        })
      return newKeyPair().andThen((keyPair) => {
        const withKeys: ConnectorExtensionOptions = { ...options, ...keyPair }
        return localStore
          .set('options', withKeys)
          .map(() => withKeys)
          .orElse(() => ok(withKeys))
      })
    })

/**
 * Saves `changes` on top of the saved options: never the whole options object of
 * a page, which may be older than what another page saved since.
 */
export const updateExtensionOptions = (
  changes: Partial<ConnectorExtensionOptions>,
) =>
  getExtensionOptions().andThen((current) =>
    setConnectorExtensionOptions({ ...current, ...changes }),
  )

export const setConnectorExtensionOptions = (
  connectorExtensionOptions: ConnectorExtensionOptions,
) => {
  logger.debug('setConnectorExtensionOptions', connectorExtensionOptions)
  return localStore.set('options', connectorExtensionOptions)
}
