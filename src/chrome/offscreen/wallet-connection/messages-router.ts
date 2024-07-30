import { errAsync, ok, okAsync, ResultAsync } from 'neverthrow'
import { AppLogger } from 'utils/logger'

export type MessagesRouter = ReturnType<typeof MessagesRouter>

type Item = {
  tabId: number
  origin: string
  networkId: number
  sessionId?: string
}

export const MessagesRouter = ({ logger }: { logger: AppLogger }) => {
  const sublogger = logger.getSubLogger({ name: 'MessagesRouter' })
  const store = new Map<string, Item>()

  const add = (
    tabId: number,
    interactionId: string,
    metadata: {
      origin: string
      networkId: number
      sessionId?: string
    },
  ) => {
    const { origin, networkId, sessionId } = metadata
    store.set(interactionId, { tabId, origin, networkId, sessionId })
    sublogger.debug('add', {
      tabId,
      interactionId,
      origin,
      sessionId,
    })
    return ok(undefined)
  }

  const getByInteractionId = (
    interactionId: string,
  ): ResultAsync<Item, Error> => {
    const values = store.get(interactionId)
    return values ? okAsync(values) : errAsync(new Error('Item not found'))
  }

  const getNetworkId = (interactionId: string): ResultAsync<number, Error> => {
    const values = store.get(interactionId)
    return values
      ? okAsync(values.networkId)
      : errAsync(new Error('Item not found'))
  }

  const getInteractionIdsByTabId = (
    tabId: number,
  ): ResultAsync<string[], Error> => {
    const interactionIds = [...store.entries()]
      .filter(([, value]) => value.tabId === tabId)
      .map(([key]) => key)

    return interactionIds.length
      ? okAsync(interactionIds)
      : errAsync(new Error('No interactionId found'))
  }

  const removeByTabId = (tabId: number) =>
    getInteractionIdsByTabId(tabId).map((interactionIds) => {
      sublogger.debug('removeByTabId', { tabId, interactionIds })
      interactionIds.forEach((interactionId) => store.delete(interactionId))
    })

  const getAndRemoveByTabId = (tabId: number) =>
    getInteractionIdsByTabId(tabId).map((interactionIds) => {
      sublogger.debug('getAndRemoveByTabId', { tabId, interactionIds })
      interactionIds.forEach((interactionId) => store.delete(interactionId))
      return interactionIds
    })

  const removeByInteractionId = (interactionId: string) => {
    sublogger.debug('removeByInteractionId', { interactionId })
    store.delete(interactionId)
  }

  return {
    add,
    getByInteractionId,
    store,
    getNetworkId,
    getInteractionIdsByTabId,
    removeByTabId,
    removeByInteractionId,
    getAndRemoveByTabId,
  }
}
