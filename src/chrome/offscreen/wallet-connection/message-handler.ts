import { createMessage } from 'chrome/messages/create-message'
import { MessagesRouter } from 'chrome/offscreen/wallet-connection/messages-router'
import { ResultAsync, errAsync, okAsync } from 'neverthrow'
import { Queue } from 'queues/queue'
import { AppLogger, logger as appLogger } from 'utils/logger'
import {
  AccountListMessage,
  LedgerResponse,
  LinkClientInteraction,
  isLedgerRequest,
} from 'ledger/schemas'
import { sendMessage } from 'chrome/helpers/send-message'
import {
  WalletInteraction,
  WalletInteractionExtensionInteraction,
} from '@radixdlt/radix-dapp-toolkit'
import {
  Message,
  MessageHandler,
  MessageHandlerOutput,
  SendMessageWithConfirmation,
  messageDiscriminator,
} from 'chrome/messages/_types'
import { syncClient } from './sync-client'
import { SessionRouter } from '../session-router'

const isExtensionMessage = (
  message: any,
): message is AccountListMessage | LinkClientInteraction =>
  ['accountList', 'linkClient'].includes(message.discriminator)

export type WalletConnectionMessageHandler = ReturnType<
  typeof WalletConnectionMessageHandler
>
export const WalletConnectionMessageHandler = (input: {
  dAppRequestQueue: Queue<WalletInteraction>
  extensionToWalletQueue: Queue<LedgerResponse>
  incomingWalletMessageQueue: Queue<any>
  messagesRouter: MessagesRouter
  sessionRouter: SessionRouter
  logger?: AppLogger
  walletPublicKey: string
}): MessageHandler => {
  const dAppRequestQueue = input.dAppRequestQueue
  const extensionToWalletQueue = input.extensionToWalletQueue
  const incomingWalletMessageQueue = input.incomingWalletMessageQueue
  const messagesRouter = input.messagesRouter
  const sessionRouter = input.sessionRouter
  const walletPublicKey = input.walletPublicKey
  const logger = input.logger || appLogger

  return (
    message: Message,
    sendMessageWithConfirmation: SendMessageWithConfirmation,
    tabId?: number,
  ): MessageHandlerOutput => {
    switch (message?.discriminator) {
      // Message from wallet to extension (incldues ledger, dApp and accountList message)
      case messageDiscriminator.walletMessage: {
        if (isLedgerRequest(message.data)) {
          logger.debug('🪪 -> 📒: walletToLedgerSubject', message.data)

          return sendMessageWithConfirmation(
            createMessage.walletToLedger(
              'offScreen',
              message.data,
              walletPublicKey,
            ),
          ).map(() => ({ sendConfirmation: false }))
        } else if (isExtensionMessage(message.data)) {
          logger.debug('Wallet to extension', message.data)
          return sendMessageWithConfirmation(
            createMessage.walletToExtension(
              'offScreen',
              message.data,
              walletPublicKey,
            ),
          ).map(() => ({ sendConfirmation: false }))
        } else {
          incomingWalletMessageQueue.add(
            message.data,
            message.data.interactionId,
          )
        }

        return okAsync({ sendConfirmation: false })
      }

      case messageDiscriminator.cancelWalletInteraction: {
        const { interactionId, metadata } = message.interaction
        return dAppRequestQueue
          .cancel(interactionId)
          .andThen(() =>
            sendMessageWithConfirmation(
              createMessage.sendMessageEventToDapp(
                'offScreen',
                'requestCancelSuccess',
                { interactionId, metadata },
              ),
              tabId,
            ),
          )
      }

      // Message from dApp to wallet
      case messageDiscriminator.walletInteraction: {
        const walletInteraction =
          message.interaction as WalletInteractionExtensionInteraction
        const { interactionId, sessionId, interaction } = walletInteraction
        const { metadata, items } = interaction

        return messagesRouter
          .add(tabId!, interactionId, {
            ...metadata,
            sessionId,
          })
          .asyncAndThen(() => {
            const walletPublicKeyForSessionId =
              sessionRouter.getWalletPublicKey(sessionId)
            if (items.discriminator === 'cancelRequest') {
              return dAppRequestQueue
                .cancel(interactionId)
                .andThen(() =>
                  sendMessageWithConfirmation(
                    createMessage.sendMessageEventToDapp(
                      'offScreen',
                      'requestCancelSuccess',
                      { interactionId, metadata },
                    ),
                    tabId,
                  ),
                )
            }

            if (
              [undefined, walletPublicKey].includes(walletPublicKeyForSessionId)
            ) {
              return dAppRequestQueue.add(
                {
                  items,
                  metadata,
                  interactionId,
                } as WalletInteraction,
                interactionId,
              )
            }

            return okAsync(undefined)
          })
          .map(() => ({ sendConfirmation: true }))
      }

      case messageDiscriminator.dAppRequest: {
        const walletInteraction: WalletInteraction = message.data
        const { interactionId, metadata, items } = walletInteraction

        return messagesRouter
          .add(tabId!, interactionId, metadata)
          .asyncAndThen(() => {
            if (walletInteraction.items.discriminator === 'cancelRequest') {
              return dAppRequestQueue
                .cancel(interactionId)
                .andThen(() =>
                  sendMessageWithConfirmation(
                    createMessage.sendMessageEventToDapp(
                      'offScreen',
                      'requestCancelSuccess',
                      { interactionId, metadata },
                    ),
                    tabId,
                  ),
                )
            }

            return dAppRequestQueue.add(
              {
                items,
                metadata,
                interactionId,
              } as WalletInteraction,
              interactionId,
            )
          })
          .map(() => ({ sendConfirmation: true }))
      }

      case messageDiscriminator.incomingWalletMessage:
        return messagesRouter
          .getByInteractionId(message.data.interactionId)
          .mapErr(() => ({ reason: 'tabIdNotFound' }))
          .andThen((metadata) => {
            sendMessage(
              // this is for background script to handle notifications
              createMessage.walletResponse('offScreen', {
                ...message.data,
                metadata: {
                  networkId: metadata.networkId,
                  sessionId: metadata.sessionId,
                  walletPublicKey,
                },
              }),
            )
            return sendMessageWithConfirmation(
              // this is targeted to particular dApp
              createMessage.walletResponse('offScreen', {
                walletResponse: message.data,
                metadata,
              }),
              metadata.tabId,
            )
          })
          .map(() => ({ sendConfirmation: true }))
          .map((response) => {
            syncClient.addResponseForInteractionId(message.data.interactionId)
            return response
          })

      case messageDiscriminator.ledgerResponse:
        if (message.walletPublicKey !== walletPublicKey) {
          return okAsync({ sendConfirmation: false })
        }

        return extensionToWalletQueue
          .add(message.data, message.data.interactionId)
          .map(() => ({ sendConfirmation: false }))

      case messageDiscriminator.closeDappTab: {
        const { tabId } = message
        return messagesRouter
          .getAndRemoveByTabId(tabId)
          .mapErr(() => ({ reason: 'tabIdNotFound' }))
          .map((interactionIds) => {
            for (const interactionId of interactionIds) {
              ResultAsync.combine([
                dAppRequestQueue.cancel(interactionId),
                incomingWalletMessageQueue.cancel(interactionId),
              ])
            }
          })
          .map(() => ({ sendConfirmation: false }))
      }

      default:
        return errAsync({
          reason: 'unhandledMessageDiscriminator',
        })
    }
  }
}
