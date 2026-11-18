import { createLedgerErrorResponse } from './../../ledger/schemas'
import { sessionStore } from 'chrome/helpers/storage'
import { createMessage } from 'chrome/messages/create-message'
import { sendMessage } from 'chrome/messages/send-message'
import type { LedgerRequest } from 'ledger/schemas'

export const LedgerTabWatcher = () => ({
  getCurrentlyWatched: () =>
    sessionStore
      .get('watchedTab')
      .mapErr(() => ({ reason: 'failedToGetWatchedTab' })),
  setWatchedTab: (
    tabId: number,
    request: LedgerRequest,
    walletPublicKey: string,
  ) =>
    sessionStore.set('watchedTab', {
      tabId,
      request,
      walletPublicKey,
    }),
  triggerTabRemoval: async (justRemovedTabId: number) => {
    const watchedTab = await sessionStore.get('watchedTab')
    if (watchedTab.isErr() || !watchedTab.value) {
      return
    }

    const { tabId, request, walletPublicKey } = watchedTab.value

    if (!tabId || justRemovedTabId !== tabId || !request || !walletPublicKey) {
      return
    }

    sendMessage(
      createMessage.ledgerResponse(
        createLedgerErrorResponse(request, 'tabClosed'),
        walletPublicKey,
      ),
    )

    sessionStore.set('watchedTab', {})
  },
  restoreInitial: () => sessionStore.set('watchedTab', {}),
})
