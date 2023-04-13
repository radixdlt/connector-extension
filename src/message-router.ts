import { errAsync, ok, okAsync, ResultAsync } from 'neverthrow'
import { AppLogger } from 'utils/logger'

export type MessagesRouter = ReturnType<typeof MessagesRouter>

export const MessagesRouter = ({ logger }: { logger: AppLogger }) => {
  const store = new Map<string, number>()

  const add = (tabId: number, interactionId: string) => {
    store.set(interactionId, tabId)
    return ok(undefined)
  }

  const getTabId = (interactionId: string): ResultAsync<number, Error> => {
    const tabId = store.get(interactionId)
    return tabId ? okAsync(tabId) : errAsync(new Error('No tab found'))
  }

  return {
    add,
    getTabId,
    store,
  }
}
