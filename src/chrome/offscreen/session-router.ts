export type SessionRouter = ReturnType<typeof SessionRouter>

export type SessionId = string
export type WalletPublicKey = string

export const SessionRouter = () => {
  const store = new Map<SessionId, WalletPublicKey>()

  const getWalletPublicKey = (sessionId?: SessionId) =>
    sessionId ? store.get(sessionId) : undefined

  const refreshStore = (data: Record<SessionId, WalletPublicKey>) => {
    store.clear()
    Object.entries(data).forEach(([sessionId, walletPublicKey]) => {
      store.set(sessionId, walletPublicKey)
    })
  }

  return {
    refreshStore,
    getWalletPublicKey,
    store,
  }
}
