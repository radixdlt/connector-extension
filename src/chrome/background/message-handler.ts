import { closePopup as closePopupFn } from 'chrome/helpers/close-popup'
import { openParingPopup as openParingPopupFn } from 'chrome/helpers/open-pairing-popup'
import { errAsync, okAsync, ResultAsync } from 'neverthrow'
import { AppLogger } from 'utils/logger'
import {
  messageDiscriminator,
  Message,
  SendMessageWithConfirmation,
  MessageHandlerOutput,
  messageSource,
} from '../messages/_types'
import {
  getConnections as getConnectionsFn,
  hasConnections,
} from '../helpers/get-connections'
import { config } from 'config'
import { LedgerTabWatcher } from './ledger-tab-watcher'
import { ensureTab } from 'chrome/helpers/ensure-tab'
import { focusTabByUrl } from 'chrome/helpers/focus-tab'
import { createGatewayModule } from './create-gateway-module'
import { notificationDispatcher } from './notification-dispatcher'
import { getExtensionOptions } from 'options'
import { chromeLocalStore } from 'chrome/helpers/chrome-local-store'
import { RadixNetworkConfigById } from '@radixdlt/babylon-gateway-api-sdk'
import { Connections, ConnectionsClient } from 'pairing/state/connections'
import { WalletInteraction } from '@radixdlt/radix-dapp-toolkit'
import { getSessionRouterData } from 'chrome/offscreen/session-router'

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
    getConnections: () => ResultAsync<Connections, never>
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
        return getExtensionOptions().map((options) => ({
          sendConfirmation: true,
          data: { options },
        }))
      case messageDiscriminator.getConnections:
        return getConnections().map((data) => ({
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
          const gateway = createGatewayModule(networkId)

          gateway.pollTransactionStatus(txIntentHash).map((result) => {
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
        return getSessionRouterData().map((data) => ({
          sendConfirmation: true,
          data,
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

        return okAsync({ sendConfirmation: false })

      case messageDiscriminator.walletToLedger:
        return ledgerTabWatcher
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
          .mapErr(() => ({ reason: 'failedRestoringTabWatcher' }))

      default:
        return errAsync({
          reason: 'unhandledMessageDiscriminator',
        })
    }
  }
