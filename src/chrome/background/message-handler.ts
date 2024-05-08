import { closePopup as closePopupFn } from 'chrome/helpers/close-popup'
import { openParingPopup as openParingPopupFn } from 'chrome/helpers/open-pairing-popup'
import { errAsync, ok, okAsync, ResultAsync } from 'neverthrow'
import { AppLogger } from 'utils/logger'
import {
  messageDiscriminator,
  Message,
  SendMessageWithConfirmation,
  MessageHandlerOutput,
} from '../messages/_types'
import {
  getConnections as getConnectionsFn,
  hasConnections,
} from '../helpers/get-connections'
import { config } from 'config'
import { LedgerTabWatcher } from './ledger-tab-watcher'
import { ensureTab } from 'chrome/helpers/ensure-tab'
import { focusTabByUrl } from 'chrome/helpers/focus-tab'
import { createGatewayClient } from './gateway-client'
import {
  notificationDispatcher,
  WalletInteraction,
} from './notification-dispatcher'
import { getExtensionOptions } from 'options'
import { chromeLocalStore } from 'chrome/helpers/chrome-local-store'
import { RadixNetworkConfigById } from '@radixdlt/babylon-gateway-api-sdk'
import { ConnectionsClient } from 'pairing/state/connections'

export type BackgroundMessageHandler = ReturnType<
  typeof BackgroundMessageHandler
>
export const BackgroundMessageHandler =
  ({
    logger,
    ledgerTabWatcher = LedgerTabWatcher(),
    getConnections = getConnectionsFn,
    closePopup = closePopupFn,
    openParingPopup = openParingPopupFn,
  }: Partial<{
    logger?: AppLogger
    ledgerTabWatcher: ReturnType<typeof LedgerTabWatcher>
    getConnections: () => ResultAsync<any, Error>
    closePopup: () => ResultAsync<any, Error>
    openParingPopup: () => ResultAsync<any, Error>
  }>) =>
  (
    message: Message,
    sendMessageWithConfirmation: SendMessageWithConfirmation,
  ): MessageHandlerOutput => {
    const walletInteractionHandler = (data: WalletInteraction) => {
      hasConnections().map((hasConnections) => {
        if (hasConnections) {
          notificationDispatcher.request(data as WalletInteraction)
        }
      })

      return okAsync({ sendConfirmation: false })
    }

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
      case messageDiscriminator.getConnections:
        return getConnections()
          .mapErr((error) => ({
            reason: 'failedToGetConnections',
            jsError: error,
          }))
          .map((data) => ({
            sendConfirmation: true,
            data,
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
        return hasConnections()
          .andThen((hasConnections) =>
            hasConnections
              ? closePopup().map(() => hasConnections)
              : openParingPopup().map(() => hasConnections),
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
        const sessionId = message.data?.metadata?.sessionId
        const walletPublicKey = message.data?.metadata?.walletPublicKey

        if (
          sessionId &&
          walletPublicKey &&
          message.data?.discriminator &&
          message.data.discriminator !== 'failure'
        ) {
          chromeLocalStore.getSingleItem('sessionRouter').map((data) => {
            if (!data) {
              return chromeLocalStore.setSingleItem('sessionRouter', {
                [sessionId]: walletPublicKey,
              })
            }

            if (data[sessionId] && data[sessionId] !== walletPublicKey) {
              logger?.warn(
                `sessionRouter has walletPublicKey ${data[sessionId]} for ${sessionId} but we've just had a response from ${walletPublicKey}`,
              )
            } else if (!data[sessionId]) {
              return chromeLocalStore.setSingleItem('sessionRouter', {
                ...data,
                [sessionId]: walletPublicKey,
              })
            }
          })
        }

        const canBePolled = (message: any) => {
          return (
            message.data?.items?.discriminator === 'transaction' &&
            message.data?.items?.send?.transactionIntentHash &&
            message.data?.metadata?.networkId &&
            RadixNetworkConfigById[message.data?.metadata?.networkId]
              ?.gatewayUrl
          )
        }

        const getPollParams = (message: any) => ({
          txIntentHash: message.data.items.send.transactionIntentHash,
          networkId: message.data?.metadata?.networkId,
        })

        if (canBePolled(message)) {
          const { txIntentHash, networkId } = getPollParams(message)
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

      case messageDiscriminator.getSessionRouterData: {
        return chromeLocalStore
          .getItem('sessionRouter')
          .map((data) => ({
            sendConfirmation: true,
            data,
          }))
          .mapErr(() => ({
            reason: 'failedToGetSessionRouterData',
          }))
      }

      case messageDiscriminator.dAppRequest: {
        hasConnections().map((hasConnections) => {
          if (hasConnections) {
            notificationDispatcher.request(message.data as WalletInteraction)
          }
        })

        return okAsync({ sendConfirmation: false })
      }

      case messageDiscriminator.walletInteraction: {
        return walletInteractionHandler(message.interaction.interaction)
      }

      case messageDiscriminator.walletToExtension:
        if (message.data?.discriminator === 'accountList') {
          return getConnections()
            .map((connections) =>
              ConnectionsClient(connections).updateAccounts(
                message.walletPublicKey,
                message.data.accounts,
              ),
            )
            .map(() => ({ sendConfirmation: false }))
            .mapErr(() => ({ reason: 'failedToUpdateAccounts' }))
        }

        return okAsync({ sendConfirmation: false })

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
