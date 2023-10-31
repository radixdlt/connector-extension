import { errAsync, ok, okAsync, ResultAsync } from 'neverthrow'

export type MessagesRouter = ReturnType<typeof MessagesRouter>

type Item = { tabId: number; origin: string; networkId: number }

export const MessagesRouter = () => {
  const store = new Map<string, Item>()

  const add = (
    tabId: number,
    interactionId: string,
    metadata: Record<string, any>,
  ) => {
    const { origin, networkId } = metadata
    store.set(interactionId, { tabId, origin, networkId })
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
    getInteractionIdsByTabId(tabId).map((interactionIds) =>
      interactionIds.forEach((interactionId) => store.delete(interactionId)),
    )

  const getAndRemoveByTabId = (tabId: number) =>
    getInteractionIdsByTabId(tabId).map((interactionIds) => {
      interactionIds.forEach((interactionId) => store.delete(interactionId))
      return interactionIds
    })

  return {
    add,
    getByInteractionId,
    store,
    getNetworkId,
    getInteractionIdsByTabId,
    removeByTabId,
    getAndRemoveByTabId,
  }
}
