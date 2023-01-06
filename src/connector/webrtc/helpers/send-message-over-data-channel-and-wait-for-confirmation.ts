import { Message } from 'connector/_types'
import { err, ok, Result } from 'neverthrow'
import { from, map, merge, mergeMap, Observable, of } from 'rxjs'
import { WebRtcSubjectsType } from '../subjects'
import { prepareMessage } from './prepare-message'
import { waitForConfirmation } from './wait-for-confirmation'
import { sendChunks } from './send-chunks'

export const sendMessageOverDataChannelAndWaitForConfirmation = (
  subjects: WebRtcSubjectsType,
  message: Message
) =>
  from(prepareMessage(message)).pipe(
    mergeMap((result): Observable<Result<null, Error>> => {
      if (result.isErr()) return of(err(result.error))
      const { chunks, messageId } = result.value
      return merge(
        sendChunks(subjects, chunks),
        waitForConfirmation(subjects, messageId)
      ).pipe(map(() => ok(null)))
    })
  )
