import { ok } from 'neverthrow'
import { filter, map, mergeMap, Subscription } from 'rxjs'
import { createMessage } from './create-message'
import type {
  AnswerOf,
  ConfirmationMessageError,
  Message,
  MessageHandler,
  MessageSource,
  SendMessageWithConfirmation,
} from './_types'
import { MessageSubjects } from './subjects'
import type { SendMessage } from './send-message'
import { sendMessage as sendMessageFn } from './send-message'
import type { AppLogger } from 'utils/logger'
import { config } from 'config'
import { waitForConfirmation } from './wait-for-confirmation'

export type MessageClient = ReturnType<typeof MessageClient>

export const MessageClient = (
  handler: MessageHandler,
  origin: MessageSource,
  input: {
    subjects?: MessageSubjects
    sendMessage?: SendMessage
    logger: AppLogger
    confirmationTimeout?: number
  },
) => {
  const confirmationTimeout =
    input.confirmationTimeout ?? config.messages.confirmationTimeout
  const subjects = input.subjects || MessageSubjects()
  const sendMessage = input.sendMessage || sendMessageFn

  const subscriptions = new Subscription()

  const sendMessageAndWaitForConfirmation: SendMessageWithConfirmation = <
    M extends Message,
  >(
    value: M,
    tabId?: number,
  ) => {
    const shouldProxyMessageThroughBackground =
      value.source !== 'background' && tabId

    const message = shouldProxyMessageThroughBackground
      ? createMessage.sendMessageToTab(value.source, tabId, value)
      : value

    const confirmation = waitForConfirmation<AnswerOf<M>>(
      subjects.messageSubject.pipe(map(({ message }) => message)),
      message.messageId,
      confirmationTimeout,
    )

    return sendMessage(message, tabId).andThen(() => confirmation)
  }

  const sendConfirmationSuccess = <T = any>({
    origin,
    messageId,
    tabId,
    data,
  }: {
    origin: MessageSource
    messageId: string
    tabId?: number
    data: T
  }) =>
    sendMessage(
      createMessage.confirmationSuccess(origin, messageId, data),
      tabId,
    )

  const sendConfirmationError = ({
    origin,
    messageId,
    error,
    tabId,
  }: {
    origin: MessageSource
    messageId: string
    error: ConfirmationMessageError['error']
    tabId?: number
  }) =>
    sendMessage(
      createMessage.confirmationError(origin, messageId, error),
      tabId,
    )

  subscriptions.add(
    subjects.messageSubject
      .pipe(
        filter(({ message }) => message.discriminator !== 'confirmation'),
        mergeMap(({ message, tabId }) =>
          handler(message, sendMessageAndWaitForConfirmation, tabId)
            .andThen((result) =>
              result?.sendConfirmation
                ? sendConfirmationSuccess({
                    origin,
                    messageId: message.messageId,
                    tabId,
                    data: result.data,
                  })
                : ok(undefined),
            )
            .mapErr((error) => {
              if (error.reason !== 'unhandledMessageDiscriminator')
                sendConfirmationError({
                  origin,
                  messageId: message.messageId,
                  error,
                  tabId:
                    message.discriminator === 'sendMessageToTab'
                      ? undefined
                      : tabId,
                })
            }),
        ),
      )
      .subscribe(),
  )

  return {
    onMessage: (message: Message, tabId?: number) =>
      subjects.messageSubject.next({ message, tabId }),
    handleMessage: (message: Message, tabId?: number) =>
      handler(message, sendMessageAndWaitForConfirmation, tabId),
    sendMessageAndWaitForConfirmation,
    destroy: () => {
      subscriptions.unsubscribe()
    },
  }
}
