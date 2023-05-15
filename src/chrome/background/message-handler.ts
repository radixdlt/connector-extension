import { closePopup as closePopupFn } from 'chrome/helpers/close-popup'
import { openParingPopup as openParingPopupFn } from 'chrome/helpers/open-pairing-popup'
import { errAsync, ResultAsync } from 'neverthrow'
import { AppLogger } from 'utils/logger'
import {
  messageDiscriminator,
  Message,
  SendMessageWithConfirmation,
  MessageHandlerOutput,
} from '../messages/_types'
import { getConnectionPassword as getConnectionPasswordFn } from '../helpers/get-connection-password'
import { config } from 'config'
import { createAlignedPopupWindow } from 'chrome/helpers/create-popup-window'
import { sendMessageToTab } from 'chrome/helpers/send-message-to-tab'
import { createAndFocusTab } from 'chrome/helpers/create-and-focus-tab'
import { LedgerTabWatcher } from './ledger-tab-watcher'

export type BackgroundMessageHandler = ReturnType<
  typeof BackgroundMessageHandler
>
export const BackgroundMessageHandler =
  ({
    logger,
    ledgerTabWatcher,
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
        ledgerTabWatcher?.restoreInitial()

        return createAndFocusTab(config.popup.pages.ledger)
          .andThen((tab) => {
            ledgerTabWatcher?.setWatchedTab(tab.id!, message.data.messageId)
            return sendMessageToTab(tab.id!, message.data)
          })
          .map(() => ({ sendConfirmation: false }))
          .mapErr(() => ({ reason: 'failedToOpenLedgerTab' }))
      }

      case messageDiscriminator.walletToLedger:
        ledgerTabWatcher?.restoreInitial()
        return createAlignedPopupWindow(config.popup.pages.ledger)
          .andThen((tab) => {
            ledgerTabWatcher?.setWatchedTab(tab.id!, message.messageId)

            return sendMessageWithConfirmation(
              { ...message, source: 'background' },
              tab.id
            )
          })
          .map(() => ({ sendConfirmation: true }))
          .mapErr(() => ({ reason: 'failedToOpenLedgerTab' }))

      default:
        return errAsync({
          reason: 'unhandledMessageDiscriminator',
        })
    }
  }
