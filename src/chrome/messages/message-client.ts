import { err, ok, Result, ResultAsync } from 'neverthrow'
import {
  BehaviorSubject,
  filter,
  first,
  firstValueFrom,
  map,
  merge,
  mergeMap,
  of,
  Subscription,
  switchMap,
  tap,
} from 'rxjs'
import { createMessage } from './create-message'
import {
  ConfirmationMessageError,
  ConfirmationMessageSuccess,
  Message,
  MessageHandler,
  Messages,
  MessageSource,
} from './_types'
import { MessageSubjects } from './subjects'
import { sendMessage as sendMessageFn, SendMessage } from './send-message'

export type MessageClient = ReturnType<typeof MessageClient>

export const MessageClient = (
  handler: MessageHandler,
  origin: MessageSource,
  input: {
    subjects?: MessageSubjects
    sendMessage?: SendMessage
  }
) => {
  const subjects = input.subjects || MessageSubjects()
  const sendMessage = input.sendMessage || sendMessageFn

  const subscriptions = new Subscription()

  const sendMessageAndWaitForConfirmation = <T = undefined>(
    message: Message,
    tabId?: number
  ) => {
    const sendSubject = new BehaviorSubject<number>(0)

    const confirmation$ = subjects.messageSubject.pipe(
      filter(
        (
          value
        ): value is { message: Messages['confirmation']; tabId?: number } =>
          value.message.discriminator === 'confirmation' &&
          message.messageId === value.message.messageId
      ),
      first(),
      map(
        (
          confirmation
        ): Result<
          ConfirmationMessageSuccess<T>['data'],
          ConfirmationMessageError['error']
        > =>
          confirmation.message.success
            ? ok(confirmation.message.data)
            : err(confirmation.message.error)
      )
    )

    return ResultAsync.fromPromise(
      firstValueFrom(
        sendSubject.pipe(
          switchMap(() =>
            merge(
              of(message).pipe(
                tap(() => sendMessage(message, tabId)),
                filter((value): value is never => false)
              ),
              confirmation$
            )
          )
        )
      ),
      (error) => error as ConfirmationMessageError['error']
    ).andThen((result) => result)
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
      tabId
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
      tabId
    )

  subscriptions.add(
    subjects.messageSubject
      .pipe(
        filter(({ message }) => message.discriminator !== 'confirmation'),
        mergeMap(({ message, tabId }) =>
          handler(message, sendMessageAndWaitForConfirmation, tabId)
            .andThen((result) =>
              result.sendConfirmation
                ? sendConfirmationSuccess({
                    origin,
                    messageId: message.messageId,
                    tabId,
                    data: result.data,
                  })
                : ok(undefined)
            )
            .mapErr((error) => {
              if (error.reason !== 'unhandledMessageDiscriminator')
                sendConfirmationError({
                  origin,
                  messageId: message.messageId,
                  error,
                  tabId,
                })
            })
        )
      )
      .subscribe()
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
