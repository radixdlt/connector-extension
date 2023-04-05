import { ConnectorClient } from 'connector/connector-client'
import { MessagesRouter } from 'message-router'
import { errAsync, okAsync, ResultAsync } from 'neverthrow'
import { Queue } from 'queues/queue'
import { Logger } from 'tslog'
import { messageDiscriminator, Messages, OffScreenMessage } from './_types'

export type OffscreenMessageHandler = ReturnType<typeof OffscreenMessageHandler>
export const OffscreenMessageHandler = (input: {
  connectorClient: ConnectorClient
  logger: Logger<unknown>
  dAppRequestQueue: Queue<any>
  walletResponseQueue: Queue<any>
  messageRouter: MessagesRouter
}) => {
  const connectorClient = input.connectorClient
  const logger = input.logger
  const dAppRequestQueue = input.dAppRequestQueue
  const walletResponseQueue = input.walletResponseQueue
  const messageRouter = input.messageRouter

  const handleConnectionPasswordChange = ({
    connectionPassword,
  }: Messages['connectionPasswordChange']) => {
    if (connectionPassword) {
      connectorClient.setConnectionPassword(
        Buffer.from(connectionPassword, 'hex')
      )
      connectorClient.connect()
    } else {
      connectorClient.disconnect()
    }
    return okAsync(undefined)
  }

  return (
    message: OffScreenMessage,
    tabId?: number
  ): ResultAsync<undefined, any> => {
    logger.debug(`incomingOffScreenMessage`, message)

    switch (message.discriminator) {
      case messageDiscriminator.connectionPasswordChange:
        return handleConnectionPasswordChange(message)

      case messageDiscriminator.dAppRequest:
        return messageRouter
          .add(tabId!, message.data.interactionId)
          .asyncAndThen(() =>
            dAppRequestQueue.add(message.data, message.data.interactionId)
          )
          .andThen(() => okAsync(undefined))

      case messageDiscriminator.walletResponse:
        return walletResponseQueue
          .add(message.data, message.data.interactionId)
          .andThen(() => okAsync(undefined))

      default:
        return errAsync(new Error('Unhandled message discriminator'))
    }
  }
}
