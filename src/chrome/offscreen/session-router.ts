import { localStore } from 'chrome/helpers/storage'
import type { ResultAsync } from 'neverthrow'
import { ok } from 'neverthrow'

export type SessionRouter = ReturnType<typeof SessionRouter>

export type SessionId = string
export type WalletPublicKey = string

/**
 * Which wallet each dApp session belongs to, so that its requests go to that wallet
 * only. A session whose wallet is no longer linked (forgotten, or linked again with
 * another key) belongs to none: its requests go to every linked wallet, as without a
 * session, instead of to no link at all.
 */
export const SessionRouter = () => {
  const store = new Map<SessionId, WalletPublicKey>()
  // The wallets linked now; unknown (everything allowed) until the links are known.
  let linkedWallets: Set<WalletPublicKey> | undefined

  const getWalletPublicKey = (sessionId?: SessionId) => {
    const walletPublicKey = sessionId ? store.get(sessionId) : undefined
    if (walletPublicKey && linkedWallets && !linkedWallets.has(walletPublicKey))
      return undefined
    return walletPublicKey
  }

  const setLinkedWallets = (walletPublicKeys: Iterable<WalletPublicKey>) => {
    linkedWallets = new Set(walletPublicKeys)
  }

  const refreshStore = (data: Record<SessionId, WalletPublicKey>) => {
    store.clear()
    Object.entries(data).forEach(([sessionId, walletPublicKey]) => {
      store.set(sessionId, walletPublicKey)
    })
  }

  return {
    refreshStore,
    getWalletPublicKey,
    setLinkedWallets,
    store,
  }
}

export const getSessionRouterData = (): ResultAsync<
  Record<string, string>,
  never
> =>
  localStore
    .get('sessionRouter')
    .map((sessionRouter) => sessionRouter || {})
    .orElse(() => ok({}))
