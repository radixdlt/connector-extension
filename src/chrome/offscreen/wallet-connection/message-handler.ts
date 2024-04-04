import { createMessage } from 'chrome/messages/create-message'
import { MessagesRouter } from 'chrome/offscreen/wallet-connection/messages-router'
import { ResultAsync, errAsync, ok, okAsync } from 'neverthrow'
import { Queue } from 'queues/queue'
import { AppLogger, logger as appLogger } from 'utils/logger'

import { LedgerResponse, isLedgerRequest } from 'ledger/schemas'
import { sendMessage } from 'chrome/helpers/send-message'
import { WalletInteractionWithOrigin } from '@radixdlt/radix-connect-schemas'
import {
  Message,
  MessageHandler,
  MessageHandlerOutput,
  SendMessageWithConfirmation,
  messageDiscriminator,
} from 'chrome/messages/_types'
import { syncClient } from './sync-client'
import { SessionRouter } from '../session-router'

export type WalletConnectionMessageHandler = ReturnType<
  typeof WalletConnectionMessageHandler
>
export const WalletConnectionMessageHandler = (input: {
  dAppRequestQueue: Queue<WalletInteractionWithOrigin>
  ledgerToWalletQueue: Queue<LedgerResponse>
  incomingWalletMessageQueue: Queue<any>
  messagesRouter: MessagesRouter
  sessionRouter: SessionRouter
  logger?: AppLogger
  clientId: string
}): MessageHandler => {
  const dAppRequestQueue = input.dAppRequestQueue
  const ledgerToWalletQueue = input.ledgerToWalletQueue
  const incomingWalletMessageQueue = input.incomingWalletMessageQueue
  const messagesRouter = input.messagesRouter
  const sessionRouter = input.sessionRouter
  const clientId = input.clientId
  const logger = input.logger || appLogger

  return (
    message: Message,
    sendMessageWithConfirmation: SendMessageWithConfirmation,
    tabId?: number,
  ): MessageHandlerOutput => {
    switch (message?.discriminator) {
      case messageDiscriminator.walletMessage: {
        if (isLedgerRequest(message.data)) {
          logger.debug('🪪 -> 📒: walletToLedgerSubject', message.data)

          return sendMessageWithConfirmation(
            createMessage.walletToLedger('offScreen', message.data),
          ).map(() => ({ sendConfirmation: false }))
        } else {
          incomingWalletMessageQueue.add(
            message.data,
            message.data.interactionId,
          )
        }

        return okAsync({ sendConfirmation: false })
      }

      case messageDiscriminator.dAppRequest: {
        const walletInteraction: WalletInteractionWithOrigin = message.data
        const { interactionId, metadata, arbitraryData, items } =
          walletInteraction

        return messagesRouter
          .add(tabId!, interactionId, {
            ...metadata,
            sessionId: arbitraryData?.sessionId,
          })
          .asyncAndThen(() => {
            const clientIdForSessionId = sessionRouter.getClientId(
              arbitraryData?.sessionId,
            )
            logger.info('clientIdForSessionId', clientIdForSessionId)
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

            logger.debug(
              'almost adding to request queue',
              clientId,
              arbitraryData?.sessionId,
            )

            if ([undefined, clientId].includes(clientIdForSessionId)) {
              logger.debug('add')
              return dAppRequestQueue.add(
                {
                  items,
                  metadata,
                  interactionId,
                } as WalletInteractionWithOrigin,
                interactionId,
              )
            }

            return okAsync(undefined)
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
                  clientId,
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
        return ledgerToWalletQueue
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
