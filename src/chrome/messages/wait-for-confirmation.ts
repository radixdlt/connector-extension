import { ResultAsync, errAsync, okAsync } from 'neverthrow'
import type { Observable } from 'rxjs'
import { filter, first, firstValueFrom, map, timeout } from 'rxjs'
import type {
  ConfirmationMessageError,
  ConfirmationMessageSuccess,
  Message,
  Messages,
} from './_types'

export const confirmationTimeoutReason = 'confirmationTimeout'

/**
 * Waits on `messages$` for the confirmation of the message `messageId`: its data,
 * or its error; fails with `confirmationTimeout` after `timeoutMs`. It listens from
 * the moment it is called, so call it before sending the message; it stops
 * listening once it settles.
 */
export const waitForConfirmation = <T>(
  messages$: Observable<Message>,
  messageId: string,
  timeoutMs: number,
): ResultAsync<T, ConfirmationMessageError['error']> =>
  ResultAsync.fromSafePromise(
    firstValueFrom(
      messages$.pipe(
        filter(
          (message): message is Messages['confirmation'] =>
            message?.discriminator === 'confirmation' &&
            message.messageId === messageId,
        ),
        first(),
        map((confirmation) => ({ confirmation })),
        timeout({
          first: timeoutMs,
          with: () => [{ confirmation: undefined }],
        }),
      ),
    ),
  ).andThen(({ confirmation }) =>
    !confirmation
      ? errAsync({ reason: confirmationTimeoutReason })
      : confirmation.success
      ? okAsync((confirmation as ConfirmationMessageSuccess<T>).data)
      : errAsync(confirmation.error),
  )
