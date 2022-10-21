import { DataTypes } from 'io-types/types'
import { Logger } from 'loglevel'
import { err, ok, Result } from 'neverthrow'
import { merge, Observable, of, tap, filter, map, timer, first } from 'rxjs'
import { SignalingSubjectsType } from 'connector/signaling/subjects'

export const wsMessageConfirmation =
  (subjects: SignalingSubjectsType, logger: Logger) =>
  (
    messageResult: Result<Omit<DataTypes, 'payload'>, Error>,
    timeout = 3000
  ): Observable<
    Result<boolean, Error | { requestId: string; reason: string }>
  > => {
    if (messageResult.isErr()) return of(err(messageResult.error))

    const message = messageResult.value
    const { requestId } = message
    subjects.wsOutgoingMessageSubject.next(JSON.stringify(message))
    return merge(
      subjects.wsIncomingMessageConfirmationSubject.pipe(
        tap((message) =>
          logger.debug(`📡⬇️👌 got message confirmation:\n${message.requestId}`)
        ),
        filter(
          (incomingMessage) => message.requestId === incomingMessage.requestId
        ),
        map(() => ok(true))
      ),
      subjects.wsServerErrorResponseSubject.pipe(
        map((message) => err({ requestId, reason: 'serverError', message }))
      ),
      timer(timeout).pipe(map(() => err({ requestId, reason: 'timeout' }))),
      subjects.wsErrorSubject.pipe(
        map(() => err({ requestId, reason: 'error' }))
      )
    ).pipe(first())
  }
