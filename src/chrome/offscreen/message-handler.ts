import { createMessage } from 'chrome/messages/create-message'
import { ConnectorClient } from 'connector/connector-client'
import { MessagesRouter } from 'message-router'
import { errAsync, okAsync } from 'neverthrow'
import { Queue } from 'queues/queue'
import { AppLogger } from 'utils/logger'
import {
  Message,
  messageDiscriminator,
  MessageHandler,
  MessageHandlerOutput,
  SendMessageWithConfirmation,
} from '../messages/_types'
import { LedgerResponse } from 'ledger/schemas'
import { logger as appLogger } from 'utils/logger'

export type OffscreenMessageHandler = ReturnType<typeof OffscreenMessageHandler>
export const OffscreenMessageHandler = (input: {
  connectorClient: ConnectorClient
  dAppRequestQueue: Queue<any>
  ledgerToWalletQueue: Queue<LedgerResponse>
  messageRouter: MessagesRouter
  logger?: AppLogger
}): MessageHandler => {
  const connectorClient = input.connectorClient
  const dAppRequestQueue = input.dAppRequestQueue
  const ledgerToWalletQueue = input.ledgerToWalletQueue
  const messageRouter = input.messageRouter
  const logger = input.logger || appLogger

  return (
    message: Message,
    sendMessageWithConfirmation: SendMessageWithConfirmation,
    tabId?: number
  ): MessageHandlerOutput => {
    logger.debug('offscreen message handler', message)
    switch (message.discriminator) {
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
        const { interactionId } = message.data
        return messageRouter
          .add(tabId!, interactionId)
          .asyncAndThen(() => dAppRequestQueue.add(message.data, interactionId))
          .andThen(() => okAsync({ sendConfirmation: true }))
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

      default:
        return errAsync({
          reason: 'unhandledMessageDiscriminator',
        })
    }
  }
}
