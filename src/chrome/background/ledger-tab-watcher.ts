import { createMessage } from 'chrome/messages/create-message'
import { sendMessage } from 'chrome/messages/send-message'

export const LedgerTabWatcher = () => {
  let tabId: number | undefined
  let messageId: string | undefined
  return {
    getCurrentlyWatched: () => ({ tabId, messageId }),
    setWatchedTab: (_tabId: number, _messageId: string) => {
      tabId = _tabId
      messageId = _messageId
    },
    triggerTabRemoval: (justRemovedTabId: number) => {
      if (!messageId || !tabId || justRemovedTabId !== tabId) {
        return
      }

      sendMessage(
        createMessage.confirmationError('ledger', messageId, {
          reason: 'tabClosed',
        })
      )

      tabId = undefined
      messageId = undefined
    },
    restoreInitial: () => {
      tabId = undefined
      messageId = undefined
    },
  }
}
