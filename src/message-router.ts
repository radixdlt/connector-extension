import { errAsync, ok, okAsync, ResultAsync } from 'neverthrow'
import { AppLogger } from 'utils/logger'

export type MessagesRouter = ReturnType<typeof MessagesRouter>

export const MessagesRouter = ({ logger }: { logger: AppLogger }) => {
  const store = new Map<string, { tabId: number; origin: string }>()

  const add = (tabId: number, interactionId: string, origin: string) => {
    store.set(interactionId, { tabId, origin })
    return ok(undefined)
  }

  const getTabId = (interactionId: string): ResultAsync<number, Error> => {
    const values = store.get(interactionId)
    return values ? okAsync(values.tabId) : errAsync(new Error('No tab found'))
  }

  const getInteractionIdsByTabId = (
    tabId: number
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
      interactionIds.forEach((interactionId) => store.delete(interactionId))
    )

  const getAndRemoveByTabId = (tabId: number) =>
    getInteractionIdsByTabId(tabId).map((interactionIds) => {
      interactionIds.forEach((interactionId) => store.delete(interactionId))
      return interactionIds
    })

  return {
    add,
    getTabId,
    store,
    getInteractionIdsByTabId,
    removeByTabId,
    getAndRemoveByTabId,
  }
}
