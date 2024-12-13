import { err, ok, Result, ResultAsync } from 'neverthrow'
import {
  filter,
  first,
  firstValueFrom,
  map,
  mergeMap,
  Subscription,
} from 'rxjs'
import { createMessage } from './create-message'
import {
  ConfirmationMessageError,
  ConfirmationMessageSuccess,
  Message,
  messageDiscriminator,
  MessageHandler,
  Messages,
  MessageSource,
} from './_types'
import { MessageSubjects } from './subjects'
import { sendMessage as sendMessageFn, SendMessage } from './send-message'
import { AppLogger } from 'utils/logger'

export type MessageClient = ReturnType<typeof MessageClient>

export const MessageClient = (
  handler: MessageHandler,
  origin: MessageSource,
  input: {
    subjects?: MessageSubjects
    sendMessage?: SendMessage
    logger: AppLogger
  },
) => {
  const subjects = input.subjects || MessageSubjects()
  const sendMessage = input.sendMessage || sendMessageFn

  const subscriptions = new Subscription()

  const sendMessageAndWaitForConfirmation = <T = undefined>(
    value: Message,
    tabId?: number,
  ): ResultAsync<T, ConfirmationMessageError['error']> => {
    const shouldProxyMessageThroughBackground =
      value.source !== 'background' && tabId

    const message = shouldProxyMessageThroughBackground
      ? createMessage.sendMessageToTab(value.source, tabId, value)
      : value

    const confirmation$ = subjects.messageSubject.pipe(
      filter(
        (
          value,
        ): value is { message: Messages['confirmation']; tabId?: number } =>
          value.message.discriminator === 'confirmation' &&
          message.messageId === value.message.messageId,
      ),
      first(),
      map(
        (
          confirmation,
        ): Result<
          ConfirmationMessageSuccess<T>['data'],
          ConfirmationMessageError['error']
        > =>
          confirmation.message.success
            ? ok(confirmation.message.data)
            : err(confirmation.message.error),
      ),
    )

    const waitForConfirmation = ResultAsync.fromSafePromise(
      firstValueFrom(confirmation$),
    ).andThen((result) => result)

    return sendMessage(message, tabId).andThen(() => waitForConfirmation)
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
            .andThen((result) => {
              return result?.sendConfirmation
                ? sendConfirmationSuccess({
                    origin,
                    messageId: message.messageId,
                    tabId,
                    data: result.data,
                  })
                : ok(undefined)
            })
            .mapErr((error) => {
              if (error.reason !== 'unhandledMessageDiscriminator')
                sendConfirmationError({
                  origin,
                  messageId: message.messageId,
                  error,
                  tabId:
                    message.discriminator ===
                    messageDiscriminator.sendMessageToTab
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
