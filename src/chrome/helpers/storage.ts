import { ResultAsync } from 'neverthrow'
import type { Connections } from 'pairing/state/connections'
import type { ConnectorExtensionOptions } from 'options'
import type { LedgerRequest } from 'ledger/schemas'
import type { RetiredLink } from 'chrome/links/retired-links'
import type { WalletActivity, WalletSort } from 'pairing/state/wallet-order'

// Every key the extension keeps in chrome.storage, with the type of its value. A
// new key starts here; `localStore` and `sessionStore` only accept these.

/** `chrome.storage.local`: kept across browser restarts. */
export type LocalStorageSchema = {
  /** The linked wallets, by wallet public key. */
  connections: Connections
  /** As saved: missing options fall back to their defaults when read. */
  options: Partial<ConnectorExtensionOptions>
  /** Which wallet each dApp session belongs to: wallet public key by session id. */
  sessionRouter: Record<string, string>
  /** Left by wallets older than 1.6, which must link again. */
  connectionPassword: string
  /** See `side-panel/action-behavior`. */
  openSidePanelOnActionClick: boolean
  /** See `options/advanced-diagnostics`. */
  showAdvancedDiagnostics: boolean
  /** How the main view sorts the linked wallets. */
  walletSort: WalletSort
  /** The wallets as the user arranged them (wallet public keys). */
  walletOrder: string[]
  /** When each wallet was linked and last answered a dApp, by public key. */
  walletActivity: Record<string, WalletActivity>
  /** The picture chosen for each wallet (a small data URL), by public key. */
  walletPictures: Record<string, string>
  /** Whether the wallet cards show a picture (the chosen one, or a phone). */
  showWalletPictures: boolean
  /** Forgotten links whose wallet must still be told (see `chrome/links`). */
  retiredLinks: RetiredLink[]
}

/** `chrome.storage.session`: kept while the browser runs. */
export type SessionStorageSchema = {
  /** The ledger tab and the request it handles; empty when there is none. */
  watchedTab: Partial<{
    tabId: number
    request: LedgerRequest
    walletPublicKey: string
  }>
  popupId: number | undefined
  /** How many times the service worker started, and when it last did. */
  serviceWorkerStarts: number
  serviceWorkerStartedAt: number
}

type AreaName = 'local' | 'session'

const errorOf = (error: unknown) =>
  error instanceof Error ? error : new Error(String(error))

/** Runs a chrome.storage call, synchronous throws included, as a `ResultAsync`. */
const call = <T>(fn: () => Promise<T>) =>
  ResultAsync.fromPromise((async () => fn())(), errorOf)

/**
 * Typed access to one area of chrome.storage. The area is looked up on each call,
 * so that it works wherever `chrome` is (re)defined later, as in tests.
 */
export const createStore = <Schema extends Record<string, unknown>>(
  areaName: AreaName,
) => {
  type Key = keyof Schema & string
  const area = () => chrome.storage[areaName]

  return {
    /** `undefined` when nothing is stored under `key`. */
    get: <K extends Key>(key: K): ResultAsync<Schema[K] | undefined, Error> =>
      call(() => area().get(key)).map(
        (items) => items?.[key] as Schema[K] | undefined,
      ),
    getMany: <K extends Key>(
      keys: K[],
    ): ResultAsync<Partial<Pick<Schema, K>>, Error> =>
      call(() => area().get(keys)).map(
        (items) => (items ?? {}) as Partial<Pick<Schema, K>>,
      ),
    set: <K extends Key>(key: K, value: Schema[K]): ResultAsync<void, Error> =>
      call(() => area().set({ [key]: value })),
    setMany: (values: Partial<Schema>): ResultAsync<void, Error> =>
      call(() => area().set(values)),
    remove: (key: Key): ResultAsync<void, Error> =>
      call(() => area().remove(key)),
    /**
     * Calls `listener` whenever `key` changes in this area, in any page of the
     * extension. Returns the function that stops it.
     */
    onChange: <K extends Key>(
      key: K,
      listener: (
        newValue: Schema[K] | undefined,
        oldValue: Schema[K] | undefined,
      ) => void,
    ) => {
      const onChanged = (
        changes: Record<string, chrome.storage.StorageChange>,
        changedArea: string,
      ) => {
        if (changedArea === areaName && key in changes)
          listener(changes[key].newValue, changes[key].oldValue)
      }
      chrome.storage.onChanged.addListener(onChanged)
      return () => chrome.storage.onChanged.removeListener(onChanged)
    },
  }
}

export type Store<Schema extends Record<string, unknown>> = ReturnType<
  typeof createStore<Schema>
>

export const localStore = createStore<LocalStorageSchema>('local')
export const sessionStore = createStore<SessionStorageSchema>('session')

/**
 * Updates the value of `key` in `chrome.storage.local` from what is stored now
 * (not from a page's copy, which another page may have changed since).
 */
export const updateLocalStore = <K extends keyof LocalStorageSchema>(
  key: K,
  fallback: LocalStorageSchema[K],
  update: (current: LocalStorageSchema[K]) => LocalStorageSchema[K],
) =>
  localStore
    .get(key)
    .andThen((current) => localStore.set(key, update(current ?? fallback)))
