import { createLedgerErrorResponse } from './../../ledger/schemas'
import { sessionStore } from 'chrome/helpers/set-item'
import { createMessage } from 'chrome/messages/create-message'
import { sendMessage } from 'chrome/messages/send-message'
import { LedgerRequest } from 'ledger/schemas'

export const LedgerTabWatcher = () => ({
  getCurrentlyWatched: () =>
    sessionStore
      .getSingleItem('watchedTab')
      .mapErr(() => ({ reason: 'failedToGetWatchedTab' })),
  setWatchedTab: (tabId: number, request: LedgerRequest) =>
    sessionStore.setSingleItem('watchedTab', {
      tabId,
      request,
    }),
  triggerTabRemoval: async (justRemovedTabId: number) => {
    const watchedTab = await sessionStore.getSingleItem('watchedTab')
    if (watchedTab.isErr() || !watchedTab.value) {
      return
    }

    const { tabId, request } = watchedTab.value

    if (!tabId || justRemovedTabId !== tabId) {
      return
    }

    sendMessage(
      createMessage.ledgerResponse(
        createLedgerErrorResponse(request, 'tabClosed')
      )
    )

    sessionStore.setSingleItem('watchedTab', {})
  },
  restoreInitial: () => sessionStore.setSingleItem('watchedTab', {}),
})
