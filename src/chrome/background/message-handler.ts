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
import { LedgerTabWatcher } from './ledger-tab-watcher'
import { ensureTab } from 'chrome/helpers/ensure-tab'
import { focusTabByUrl } from 'chrome/helpers/focus-tab'
import { createGatewayClient } from './gateway-client'
import {
  notificationDispatcher,
  WalletInteraction,
} from './notification-dispatcher'
import { RadixNetwork } from '@radixdlt/babylon-gateway-api-sdk'
import { getExtensionOptions } from 'options'

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
    sendMessageWithConfirmation: SendMessageWithConfirmation,
  ): MessageHandlerOutput => {
    switch (message?.discriminator) {
      case messageDiscriminator.getExtensionOptions:
        return getExtensionOptions()
          .mapErr((error) => ({
            reason: 'failedToGetExtensionOptions',
            jsError: Error('failedToGetExtensionOptions'),
          }))
          .map((options) => ({
            sendConfirmation: true,
            data: { options },
          }))
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

      case messageDiscriminator.openParingPopup:
        return openParingPopup()
          .mapErr(() => ({
            reason: 'failedToOpenParingPopup',
          }))
          .map(() => ({
            sendConfirmation: false,
          }))

      case messageDiscriminator.detectWalletLink:
        return getConnectionPassword()
          .andThen((connectionPassword) =>
            connectionPassword
              ? closePopup().map(() => !!connectionPassword)
              : openParingPopup().map(() => !!connectionPassword),
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
          message.tabId,
        ).map(() => ({
          sendConfirmation: true,
        }))
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
              })),
            )
          })
          .mapErr(() => ({ reason: 'failedToCloseLedgerTab' }))
      }

      case messageDiscriminator.focusLedgerTab: {
        return focusTabByUrl(config.popup.pages.ledger)
          .map(() => ({
            sendConfirmation: false,
          }))
          .mapErr(() => ({ reason: 'failedToFocusLedgerTab' }))
      }

      case messageDiscriminator.walletResponse: {
        if (message.data?.items?.discriminator === 'transaction') {
          const txIntentHash = message.data.items.send.transactionIntentHash
          const networkId =
            message.data?.metadata?.networkId || RadixNetwork.Ansharnet
          logger?.debug('🔁 Polling', { txIntentHash, networkId })
          const gatewayClient = createGatewayClient(networkId)

          gatewayClient.pollTransactionStatus(txIntentHash).map((result) => {
            notificationDispatcher.transaction(
              networkId,
              txIntentHash,
              result.status,
            )
          })
        }
        return okAsync({ sendConfirmation: false })
      }

      case messageDiscriminator.dAppRequest: {
        getConnectionPassword().map((connectionPassword) => {
          if (connectionPassword) {
            notificationDispatcher.request(message.data as WalletInteraction)
          }
        })

        return okAsync({ sendConfirmation: false })
      }

      case messageDiscriminator.walletToLedger:
        return ledgerTabWatcher
          .restoreInitial()
          .andThen(() =>
            ensureTab(config.popup.pages.ledger)
              .andThen((tab) =>
                ledgerTabWatcher
                  .setWatchedTab(tab.id!, message.data)
                  .map(() => tab),
              )
              .andThen((tab) =>
                sendMessageWithConfirmation(
                  { ...message, source: 'background' },
                  tab.id,
                ),
              )
              .map(() => ({ sendConfirmation: false }))
              .mapErr(() => ({ reason: 'failedToOpenLedgerTab' })),
          )
          .mapErr(() => ({ reason: 'failedRestoringTabWatcher' }))

      default:
        return errAsync({
          reason: 'unhandledMessageDiscriminator',
        })
    }
  }
