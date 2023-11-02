import { LogsClient } from './logs-client'
import { createMessage } from 'chrome/messages/create-message'
import { ConnectorClient } from '@radixdlt/radix-connect-webrtc'
import { MessagesRouter } from 'message-router'
import { ResultAsync, errAsync, okAsync } from 'neverthrow'
import { Queue } from 'queues/queue'
import { AppLogger, logger as appLogger } from 'utils/logger'
import {
  Message,
  messageDiscriminator,
  MessageHandler,
  MessageHandlerOutput,
  SendMessageWithConfirmation,
} from '../messages/_types'
import { LedgerResponse, isLedgerRequest } from 'ledger/schemas'
import { sendMessage } from 'chrome/helpers/send-message'
import { radixConnectConfig } from 'config'
import { WalletInteractionWithOrigin } from '@radixdlt/radix-connect-schemas'

export type OffscreenMessageHandler = ReturnType<typeof OffscreenMessageHandler>
export const OffscreenMessageHandler = (input: {
  logsClient: LogsClient
  connectorClient: ConnectorClient
  dAppRequestQueue: Queue<WalletInteractionWithOrigin>
  ledgerToWalletQueue: Queue<LedgerResponse>
  incomingWalletMessageQueue: Queue<any>
  messageRouter: MessagesRouter
  logger?: AppLogger
}): MessageHandler => {
  const logsClient = input.logsClient
  const connectorClient = input.connectorClient
  const dAppRequestQueue = input.dAppRequestQueue
  const ledgerToWalletQueue = input.ledgerToWalletQueue
  const incomingWalletMessageQueue = input.incomingWalletMessageQueue
  const messageRouter = input.messageRouter
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

      case messageDiscriminator.setConnectionPassword: {
        const { connectionPassword } = message
        if (connectionPassword) {
          connectorClient.setConnectionPassword(
            Buffer.from(connectionPassword, 'hex'),
          )
          connectorClient.connect()
        } else {
          connectorClient.disconnect()
        }
        return okAsync({ sendConfirmation: true })
      }

      case messageDiscriminator.setRadixConnectConfiguration: {
        const { connectorExtensionOptions } = message
        connectorClient.setConnectionConfig(
          radixConnectConfig[
            connectorExtensionOptions.radixConnectConfiguration
          ],
        )
        return okAsync({ sendConfirmation: true })
      }

      case messageDiscriminator.dAppRequest: {
        const walletInteraction: WalletInteractionWithOrigin = message.data
        const { interactionId, metadata } = walletInteraction

        return messageRouter
          .add(tabId!, interactionId, metadata)
          .asyncAndThen(() => {
            if (walletInteraction.items.discriminator === 'cancelRequest')
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

            return dAppRequestQueue.add(walletInteraction, interactionId)
          })
          .map(() => ({ sendConfirmation: true }))
      }

      case messageDiscriminator.downloadLogs: {
        logsClient.download()
        return okAsync({ sendConfirmation: false })
      }

      case messageDiscriminator.log: {
        logsClient.add(message.log)
        return okAsync({ sendConfirmation: false })
      }

      case messageDiscriminator.incomingWalletMessage:
        return messageRouter
          .getByInteractionId(message.data.interactionId)
          .mapErr(() => ({ reason: 'tabIdNotFound' }))
          .andThen((metadata) => {
            sendMessage(
              // this is for background script to handle notifications
              createMessage.walletResponse('offScreen', {
                ...message.data,
                metadata: {
                  networkId: metadata.networkId,
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

      case messageDiscriminator.ledgerResponse:
        return ledgerToWalletQueue
          .add(message.data, message.data.interactionId)
          .map(() => ({ sendConfirmation: false }))

      case messageDiscriminator.closeDappTab: {
        const { tabId } = message
        return messageRouter
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
