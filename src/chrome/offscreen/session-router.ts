import { ok } from 'neverthrow'

export type SessionRouter = ReturnType<typeof SessionRouter>

export type SessionId = string
export type ClientId = string

export const SessionRouter = () => {
  const store = new Map<SessionId, ClientId>()

  const add = (sessionId: SessionId, clientId: ClientId) => {
    store.set(sessionId, clientId)
    return ok(undefined)
  }

  const removeBySessionId = (sessionId: SessionId) => store.delete(sessionId)

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
    removeBySessionId,
  }
}
