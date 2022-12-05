import { config } from 'config'
import { messageToChunked } from 'connector/webrtc/data-chunking'
import { WebRtcSubjectsType } from 'connector/webrtc/subjects'
import { Logger } from 'loglevel'
import { err, Result } from 'neverthrow'
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
  share,
} from 'rxjs'
import { toBuffer } from 'utils/to-buffer'
import { rtcParsedIncomingMessage } from './rtc-incoming-message'

const dataChannelConfirmation =
  (subjects: WebRtcSubjectsType, logger: Logger) =>
  (messageIdResult: Result<string, Error>) =>
    rtcParsedIncomingMessage(subjects, logger).pipe(
      filter(
        (messageResult) =>
          messageIdResult.isOk() &&
          messageResult.isOk() &&
          messageResult.value.packageType === 'receiveMessageConfirmation' &&
          messageResult.value.messageId === messageIdResult.value
      ),
      tap(() => {
        const messageId = messageIdResult._unsafeUnwrap()
        return logger.debug(
          `🕸💬👌 received message confirmation for messageId:\n'${messageId}'`
        )
      })
    )

export const rtcOutgoingMessage = (
  subjects: WebRtcSubjectsType,
  logger: Logger
) =>
  subjects.rtcOutgoingMessageSubject.pipe(
    share(),
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
            dataChannelConfirmation(subjects, logger)(result),
            timer(config.webRTC.confirmationTimeout).pipe(
              map(() =>
                // eslint-disable-next-line max-nested-callbacks
                result.map((messageId) => {
                  logger.debug(
                    `❌ confirmation message timeout for messageId: '${messageId}'`
                  )
                  return err({ error: 'timeout' })
                })
              )
            )
          )
        ),
        first()
      )
    )
  )
