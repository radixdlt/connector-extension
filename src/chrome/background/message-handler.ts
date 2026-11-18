import { okAsync, ResultAsync } from 'neverthrow'
import type { AppLogger } from 'utils/logger'
import { shortWalletKey } from 'chrome/offscreen/wallet-connection/transport/diagnostics'
import type { MessageHandler } from '../messages/_types'
import { answer, messageSource, handleMessages } from '../messages/_types'
import { getConnections as getConnectionsFn } from '../helpers/get-connections'
import { config } from 'config'
import { LedgerTabWatcher } from './ledger-tab-watcher'
import { ensureTab } from 'chrome/helpers/ensure-tab'
import { focusTabByUrl } from 'chrome/helpers/focus-tab'
import { notificationDispatcher } from './notification-dispatcher'
import { getExtensionOptions } from 'options'
import { localStore } from 'chrome/helpers/storage'
import {
  activeRetiredLinks,
  forgetRetiredLink,
} from 'chrome/links/retired-links'
import { noteWalletRelay } from 'chrome/links/wallet-relay'
import type { Connections } from 'pairing/state/connections'
import { ConnectionsClient } from 'pairing/state/connections'
import { getSessionRouterData } from 'chrome/offscreen/session-router'
import { onWalletResponse } from './wallet-response'

export type BackgroundMessageHandler = ReturnType<
  typeof BackgroundMessageHandler
>
export const BackgroundMessageHandler = ({
  logger,
  ledgerTabWatcher = LedgerTabWatcher(),
  getConnections = getConnectionsFn,
}: Partial<{
  logger?: AppLogger
  ledgerTabWatcher: ReturnType<typeof LedgerTabWatcher>
  getConnections: () => ResultAsync<Connections, never>
}>): MessageHandler =>
  handleMessages({
    getExtensionOptions: (message) =>
      getExtensionOptions().map((options) => answer(message, { options })),
    getConnections: (message) =>
      getConnections().map((data) => answer(message, data)),
    sendMessageToTab: (message, sendMessageWithConfirmation) =>
      sendMessageWithConfirmation(
        { ...message.data, source: 'background' },
        message.tabId,
      ).map(() => ({
        sendConfirmation: true,
      })),
    closeLedgerTab: () =>
      ledgerTabWatcher
        .getCurrentlyWatched()
        .andThen((currentlyWatched) => {
          if (!currentlyWatched || !currentlyWatched.tabId) {
            return okAsync({ sendConfirmation: true })
          }

          const { tabId } = currentlyWatched
          return ledgerTabWatcher.restoreInitial().andThen(() =>
            ResultAsync.fromPromise(chrome.tabs.remove(tabId), () => ({
              reason: 'failedToCloseLedgerTab',
            })).map(() => ({
              sendConfirmation: false,
            })),
          )
        })
        .mapErr(() => ({ reason: 'failedToCloseLedgerTab' })),
    focusLedgerTab: () =>
      focusTabByUrl(config.popup.pages.ledger)
        .map(() => ({
          sendConfirmation: false,
        }))
        .mapErr(() => ({ reason: 'failedToFocusLedgerTab' })),
    walletResponse: (message) => {
      onWalletResponse(message.data, logger)
      return okAsync({ sendConfirmation: false })
    },
    getSessionRouterData: (message) =>
      getSessionRouterData().map((data) => answer(message, data)),
    // dApp requests (`dAppRequest`, `walletInteraction`) are left to the offscreen
    // document, which queues them and knows whether their wallet is connected: it
    // asks for their notifications.
    dAppRequestNotification: (message) => {
      notificationDispatcher.request(message.notification).mapErr(
        (error) =>
          logger?.warn('could not show the request notification', {
            action: message.notification.action,
            interactionId: message.notification.interactionId,
            message: error.message,
          }),
      )
      return okAsync({ sendConfirmation: false })
    },
    walletToExtension: (message) => {
      const { data } = message
      if (data?.discriminator === 'accountList') {
        return getConnections()
          .map((connections) =>
            ConnectionsClient(connections).updateAccounts(
              message.walletPublicKey,
              data.accounts,
            ),
          )
          .map(() => ({ sendConfirmation: false }))
          .mapErr(() => ({ reason: 'failedToUpdateAccounts' }))
      }

      // The wallet deleted this link: the extension forgets the wallet too, without
      // telling it back. The link itself authenticated the message (only the
      // offscreen document, which holds the links, may send walletToExtension).
      if (data?.discriminator === 'linkRemoved') {
        return getConnections()
          .andThen((connections) => {
            const connection = connections[message.walletPublicKey]
            if (!connection) return okAsync(undefined)
            logger?.info('the wallet removed its link: forgetting it here', {
              wallet: shortWalletKey(message.walletPublicKey),
            })
            return ResultAsync.fromSafePromise(
              Promise.resolve(
                ConnectionsClient(connections).remove(message.walletPublicKey, {
                  tellWallet: false,
                }),
              ),
            ).map(() =>
              notificationDispatcher.linkRemoved(connection.walletName),
            )
          })
          .map(() => ({ sendConfirmation: false }))
          .mapErr(() => ({ reason: 'failedToForgetWallet' }))
      }

      return okAsync({ sendConfirmation: false })
    },
    getRetiredLinks: (message) =>
      localStore
        .get('retiredLinks')
        .map((links) => answer(message, activeRetiredLinks(links)))
        .mapErr(() => ({ reason: 'failedToReadRetiredLinks' })),
    linkRemovalDelivered: (message) =>
      forgetRetiredLink(message.password)
        .map(() => ({ sendConfirmation: false }))
        .mapErr(() => ({ reason: 'failedToForgetRetiredLink' })),
    walletRelaySeen: (message) =>
      noteWalletRelay(message.walletPublicKey, message.relayUrl)
        .map(() => ({ sendConfirmation: false }))
        .mapErr(() => ({ reason: 'failedToNoteWalletRelay' })),
    walletToLedger: (message, sendMessageWithConfirmation) =>
      ledgerTabWatcher
        .restoreInitial()
        .andThen(() =>
          ensureTab(config.popup.pages.ledger)
            .andThen((tab) =>
              ledgerTabWatcher
                .setWatchedTab(tab.id!, message.data, message.walletPublicKey)
                .map(() => tab),
            )
            .andThen((tab) =>
              sendMessageWithConfirmation(
                { ...message, source: messageSource.background },
                tab.id,
              ),
            )
            .map(() => ({ sendConfirmation: false }))
            .mapErr(() => ({ reason: 'failedToOpenLedgerTab' })),
        )
        .mapErr(() => ({ reason: 'failedRestoringTabWatcher' })),
  })
