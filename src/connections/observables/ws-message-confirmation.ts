import { SubjectsType } from 'connections/subjects'
import { DataTypes } from 'io-types/types'
import log from 'loglevel'
import { err, ok, Result } from 'neverthrow'
import { merge, Observable, of, tap, filter, map, timer, first } from 'rxjs'

export const wsMessageConfirmation =
  (subjects: SubjectsType) =>
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
          log.debug(`👌 got message confirmation:\n${message.requestId}`)
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
