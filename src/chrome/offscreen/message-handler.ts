import { createMessage } from 'chrome/messages/create-message'
import { ConnectorClient } from 'connector/connector-client'
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
import { LedgerRequest, LedgerResponse, isLedgerRequest } from 'ledger/schemas'

export type OffscreenMessageHandler = ReturnType<typeof OffscreenMessageHandler>
export const OffscreenMessageHandler = (input: {
  connectorClient: ConnectorClient
  dAppRequestQueue: Queue<any>
  ledgerToWalletQueue: Queue<LedgerResponse>
  walletToLedgerQueue: Queue<LedgerRequest>
  incomingWalletMessageQueue: Queue<any>
  messageRouter: MessagesRouter
  logger?: AppLogger
}): MessageHandler => {
  const connectorClient = input.connectorClient
  const dAppRequestQueue = input.dAppRequestQueue
  const walletToLedgerQueue = input.walletToLedgerQueue
  const ledgerToWalletQueue = input.ledgerToWalletQueue
  const incomingWalletMessageQueue = input.incomingWalletMessageQueue
  const messageRouter = input.messageRouter
  const logger = input.logger || appLogger

  return (
    message: Message,
    sendMessageWithConfirmation: SendMessageWithConfirmation,
    tabId?: number
  ): MessageHandlerOutput => {
    switch (message.discriminator) {
      case messageDiscriminator.walletMessage: {
        if (isLedgerRequest(message.data)) {
          walletToLedgerQueue.add(message.data, message.data.interactionId)
        } else {
          incomingWalletMessageQueue.add(
            message.data,
            message.data.interactionId
          )
        }

        return okAsync({ sendConfirmation: false })
      }

      case messageDiscriminator.setConnectionPassword: {
        const { connectionPassword } = message
        if (connectionPassword) {
          connectorClient.setConnectionPassword(
            Buffer.from(connectionPassword, 'hex')
          )
          connectorClient.connect()
        } else {
          connectorClient.disconnect()
        }
        return okAsync({ sendConfirmation: true })
      }

      case messageDiscriminator.dAppRequest: {
        const { interactionId, metadata } = message.data
        return messageRouter
          .add(tabId!, interactionId, metadata.origin)
          .asyncAndThen(() => {
            if (message.data?.items?.discriminator === 'cancelRequest')
              return dAppRequestQueue
                .cancel(interactionId)
                .andThen(() =>
                  sendMessageWithConfirmation(
                    createMessage.sendMessageEventToDapp(
                      'offScreen',
                      'requestCancelSuccess',
                      interactionId
                    ),
                    tabId!
                  )
                )

            return dAppRequestQueue.add(message.data, interactionId)
          })
          .map(() => ({ sendConfirmation: true }))
      }

      case messageDiscriminator.incomingWalletMessage:
        return messageRouter
          .getTabId(message.data.interactionId)
          .mapErr(() => ({ reason: 'tabIdNotFound' }))
          .andThen((tabId) =>
            sendMessageWithConfirmation(
              createMessage.walletResponse('offScreen', message.data),
              tabId
            )
          )
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
