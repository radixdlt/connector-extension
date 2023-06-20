import { closePopup as closePopupFn } from 'chrome/helpers/close-popup'
import { openParingPopup as openParingPopupFn } from 'chrome/helpers/open-pairing-popup'
import { errAsync, okAsync, ResultAsync } from 'neverthrow'
import { AppLogger } from 'utils/logger'
import {
  messageDiscriminator,
  Message,
  SendMessageWithConfirmation,
  MessageHandlerOutput,
} from '../messages/_types'
import { getConnectionPassword as getConnectionPasswordFn } from '../helpers/get-connection-password'
import { config } from 'config'
import { sendMessageToTab } from 'chrome/helpers/send-message-to-tab'
import { createAndFocusTab } from 'chrome/helpers/create-and-focus-tab'
import { LedgerTabWatcher } from './ledger-tab-watcher'
import { createOrFocusPopupWindow } from 'chrome/helpers/create-or-focus-popup-window'

export type BackgroundMessageHandler = ReturnType<
  typeof BackgroundMessageHandler
>
export const BackgroundMessageHandler =
  ({
    logger,
    ledgerTabWatcher = LedgerTabWatcher(),
    getConnectionPassword = getConnectionPasswordFn,
    closePopup = closePopupFn,
    openParingPopup = openParingPopupFn,
  }: Partial<{
    logger?: AppLogger
    ledgerTabWatcher: ReturnType<typeof LedgerTabWatcher>
    getConnectionPassword: () => ResultAsync<any, Error>
    closePopup: () => ResultAsync<any, Error>
    openParingPopup: () => ResultAsync<any, Error>
  }>) =>
  (
    message: Message,
    sendMessageWithConfirmation: SendMessageWithConfirmation
  ): MessageHandlerOutput => {
    switch (message.discriminator) {
      case messageDiscriminator.getConnectionPassword:
        return getConnectionPassword()
          .mapErr((error) => ({
            reason: 'failedToGetConnectionPassword',
            jsError: error,
          }))
          .map((connectionPassword) => ({
            sendConfirmation: true,
            data: { connectionPassword },
          }))

      case messageDiscriminator.detectWalletLink:
        return getConnectionPassword()
          .andThen((connectionPassword) =>
            connectionPassword
              ? closePopup().map(() => !!connectionPassword)
              : openParingPopup().map(() => !!connectionPassword)
          )
          .map((isLinked) => ({
            sendConfirmation: true,
            data: { isLinked },
          }))
          .mapErr((error) => ({
            reason: 'failedToDetectWalletLink',
            jsError: error,
          }))

      case messageDiscriminator.sendMessageToTab: {
        return sendMessageWithConfirmation(
          { ...message.data, source: 'background' },
          message.tabId
        ).map(() => ({
          sendConfirmation: true,
        }))
      }

      case messageDiscriminator.convertPopupToTab: {
        ledgerTabWatcher.restoreInitial()

        return createAndFocusTab(config.popup.pages.ledger)
          .andThen((tab) =>
            ledgerTabWatcher
              .setWatchedTab(tab.id!, message.data.data)
              .map(() => tab)
          )
          .andThen((tab) => sendMessageToTab(tab.id!, message.data))
          .map(() => ({ sendConfirmation: false }))
          .mapErr(() => ({ reason: 'failedToOpenLedgerTab' }))
      }

      case messageDiscriminator.closeLedgerTab: {
        return ledgerTabWatcher
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
              }))
            )
          })
          .mapErr(() => ({ reason: 'failedToCloseLedgerTab' }))
      }

      case messageDiscriminator.walletToLedger:
        return ledgerTabWatcher
          .restoreInitial()
          .andThen(() =>
            createOrFocusPopupWindow(config.popup.pages.ledger)
              .andThen((tab) =>
                ledgerTabWatcher
                  .setWatchedTab(tab.id!, message.data)
                  .map(() => tab)
              )
              .andThen((tab) =>
                sendMessageWithConfirmation(
                  { ...message, source: 'background' },
                  tab.id
                )
              )
              .map(() => ({ sendConfirmation: true }))
              .mapErr(() => ({ reason: 'failedToOpenLedgerTab' }))
          )
          .mapErr(() => ({ reason: 'failedRestoringTabWatcher' }))

      default:
        return errAsync({
          reason: 'unhandledMessageDiscriminator',
        })
    }
  }
