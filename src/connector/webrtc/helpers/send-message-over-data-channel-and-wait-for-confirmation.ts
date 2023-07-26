import {
  ChunkedMessageType,
  MessageConfirmation,
  messageErrorReasons,
  MessageErrorReasons,
  MessageErrorTypes,
} from 'connector/_types'
import { errAsync, okAsync, ResultAsync } from 'neverthrow'
import { filter, firstValueFrom, Subject } from 'rxjs'
import { prepareMessage } from './prepare-message'

const sendChunks = (
  chunks: string[],
  sendMessageOverDataChannelSubject: Subject<string>,
) => {
  chunks.forEach((chunk) => sendMessageOverDataChannelSubject.next(chunk))
  return okAsync(undefined)
}

const waitForConfirmation = (
  messageId: string,
  onDataChannelMessageSubject: Subject<ChunkedMessageType>,
) =>
  ResultAsync.fromSafePromise(
    firstValueFrom(
      onDataChannelMessageSubject.pipe(
        filter(
          (message): message is MessageConfirmation | MessageErrorTypes =>
            ['receiveMessageConfirmation', 'receiveMessageError'].includes(
              message.packageType,
            ) && message.messageId === messageId,
        ),
      ),
    ),
  ).andThen(
    (
      message,
    ): ResultAsync<MessageConfirmation, { reason: MessageErrorReasons }> =>
      message.packageType === 'receiveMessageConfirmation'
        ? okAsync(message)
        : errAsync({ reason: message.error }),
  )

export const sendMessageOverDataChannelAndWaitForConfirmation = (input: {
  message: Record<string, any>
  sendMessageOverDataChannelSubject: Subject<string>
  onDataChannelMessageSubject: Subject<ChunkedMessageType>
  messageEventCallback: (event: 'messageSent') => void
  timeout?: number
}): ResultAsync<
  undefined,
  {
    reason: MessageErrorReasons
  }
> =>
  prepareMessage(input.message)
    .mapErr((): { reason: MessageErrorReasons } => ({
      reason: messageErrorReasons.failedToPrepareMessage,
    }))
    .andThen(({ chunks, messageId }) =>
      ResultAsync.combine([
        sendChunks(
          chunks as string[],
          input.sendMessageOverDataChannelSubject,
        ).map(() => {
          input.messageEventCallback('messageSent')
          if (input.timeout)
            setTimeout(() => {
              input.onDataChannelMessageSubject.next({
                packageType: 'receiveMessageError',
                messageId,
                error: messageErrorReasons.timeout,
              })
            }, input.timeout)
        }),
        waitForConfirmation(messageId, input.onDataChannelMessageSubject),
      ]),
    )
    .map(() => undefined)
