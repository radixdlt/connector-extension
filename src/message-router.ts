import { getTabById } from 'chrome/helpers/get-tab-by-id'
import { sendMessageToTab } from 'chrome/helpers/send-message-to-tab'
import { errAsync, ok, okAsync, ResultAsync } from 'neverthrow'

export type MessagesRouter = ReturnType<typeof MessagesRouter>

export const MessagesRouter = () => {
  const store = new Map<string, number>()

  const add = (tabId: number, interactionId: string) => {
    store.set(interactionId, tabId)
    return ok(undefined)
  }

  const getTabId = (interactionId: string): ResultAsync<number, Error> => {
    const tabId = store.get(interactionId)
    return tabId ? okAsync(tabId) : errAsync(new Error('No tab found'))
  }

  const send = (interactionId: string, message: any) =>
    getTabId(interactionId).andThen((tabId) =>
      getTabById(tabId)
        .andThen(() => sendMessageToTab(tabId, message))
        .map(() => {
          store.delete(interactionId)
        })
    )

  return {
    add,
    getTabId,
    send,
  }
}
