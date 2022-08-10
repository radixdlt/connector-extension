import { config } from 'config'
import { messageToChunked } from 'connections/data-chunking'
import { SubjectsType } from 'connections/subjects'
import log from 'loglevel'
import { Result } from 'neverthrow'
import {
  concatMap,
  from,
  mergeMap,
  timer,
  map,
  first,
  filter,
  tap,
  merge,
} from 'rxjs'
import { toBuffer } from 'utils/to-buffer'
import { rtcParsedIncomingMessage } from './rtc-incoming-message'

const dataChannelConfirmation =
  (subjects: SubjectsType) => (messageIdResult: Result<string, Error>) =>
    rtcParsedIncomingMessage(subjects).pipe(
      filter(
        (messageResult) =>
          messageIdResult.isOk() &&
          messageResult.isOk() &&
          messageResult.value.packageType === 'receiveMessageConfirmation' &&
          messageResult.value.messageId === messageIdResult.value
      ),
      tap(() =>
        log.debug(
          `👌 received message confirmation for messageId: '${messageIdResult._unsafeUnwrap()}'`
        )
      )
    )

export const rtcOutgoingMessage = (subjects: SubjectsType) =>
  subjects.rtcOutgoingMessageSubject.pipe(
    concatMap((rawMessage) =>
      from(
        messageToChunked(toBuffer(rawMessage)).map((message) => {
          const chunks = [
            JSON.stringify(message.metaData),
            ...message.chunks.map((chunk) => JSON.stringify(chunk)),
          ]
          chunks.forEach((chunk) =>
            subjects.rtcOutgoingChunkedMessageSubject.next(chunk)
          )
          return message.metaData.messageId
        })
      ).pipe(
        mergeMap((result) =>
          merge(
            dataChannelConfirmation(subjects)(result),
            timer(config.webRTC.confirmationTimeout).pipe(
              map(() =>
                // eslint-disable-next-line max-nested-callbacks
                result.map((messageId) =>
                  log.debug(
                    `❌ confirmation message timeout for messageId: '${messageId}'`
                  )
                )
              )
            )
          )
        ),
        first()
      )
    )
  )
