import { sessionStore } from 'chrome/helpers/set-item'
import { createMessage } from 'chrome/messages/create-message'
import { sendMessage } from 'chrome/messages/send-message'

export const LedgerTabWatcher = () => ({
  getCurrentlyWatched: () =>
    sessionStore
      .getSingleItem('watchedTab')
      .mapErr(() => ({ reason: 'failedToGetWatchedTab' })),
  setWatchedTab: (_tabId: number, _messageId: string) =>
    sessionStore.setSingleItem('watchedTab', {
      tabId: _tabId,
      messageId: _messageId,
    }),
  triggerTabRemoval: async (justRemovedTabId: number) => {
    const watchedTab = await sessionStore.getSingleItem('watchedTab')
    if (watchedTab.isErr() || !watchedTab.value) {
      return
    }

    const { tabId, messageId } = watchedTab.value

    if (!messageId || !tabId || justRemovedTabId !== tabId) {
      return
    }

    sendMessage(
      createMessage.confirmationError('ledger', messageId, {
        reason: 'tabClosed',
      })
    )

    sessionStore.setSingleItem('watchedTab', {})
  },
  restoreInitial: () => sessionStore.setSingleItem('watchedTab', {}),
})
