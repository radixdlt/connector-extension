export type SessionRouter = ReturnType<typeof SessionRouter>

export type SessionId = string
export type ClientId = string

export const SessionRouter = () => {
  const store = new Map<SessionId, ClientId>()

  const getClientId = (sessionId: SessionId) => store.get(sessionId)

  const refreshStore = (data: Record<SessionId, ClientId>) => {
    store.clear()
    Object.entries(data).forEach(([sessionId, clientId]) => {
      store.set(sessionId, clientId)
    })
  }

  return {
    refreshStore,
    getClientId,
    store,
  }
}
