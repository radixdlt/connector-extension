import { exhaustMap, filter, first, tap, map, share } from 'rxjs'
import { Chunked } from 'webrtc/data-chunking'
import { Logger } from 'loglevel'
import { ok, err } from 'neverthrow'
import { ChunkedMessageType } from 'webrtc/data-chunking'
import { parseJSON } from 'utils'
import { toBuffer } from 'utils/to-buffer'
import { WebRtcSubjectsType } from 'webrtc/subjects'

export const rtcParsedIncomingMessage = (
  subjects: WebRtcSubjectsType,
  logger: Logger
) =>
  subjects.rtcIncomingChunkedMessageSubject.pipe(
    // TODO: add runtime message validation
    map((rawMessage) => {
      const message = toBuffer(rawMessage).toString('utf-8')
      logger.debug(
        `🕸⬇️🔪💬 incoming chunked message:\nsize: ${message.length} Bytes\n${message}`
      )
      return parseJSON<ChunkedMessageType>(message)
    }),
    share()
  )

export const rtcIncomingMessage = (
  subjects: WebRtcSubjectsType,
  logger: Logger
) =>
  rtcParsedIncomingMessage(subjects, logger).pipe(
    exhaustMap((messageResult) => {
      const chunkedResult = messageResult.andThen((message) =>
        message.packageType === 'metaData'
          ? ok(Chunked(message, logger))
          : err(Error(`expected metaData got '${message.packageType}'`))
      )
      if (chunkedResult.isErr()) return [chunkedResult]
      const chunked = chunkedResult.value

      return rtcParsedIncomingMessage(subjects, logger).pipe(
        tap((result) =>
          result.map((message) =>
            message.packageType === 'chunk'
              ? chunked.addChunk(message)
              : undefined
          )
        ),
        filter(() => {
          const allChunksReceived = chunked.allChunksReceived()
          return allChunksReceived.isOk() && allChunksReceived.value
        }),
        first(),
        tap(() =>
          chunked
            .toString()
            .map((message) => {
              subjects.rtcOutgoingConfirmationMessageSubject.next({
                packageType: 'receiveMessageConfirmation',
                messageId: chunked.metaData.messageId,
              })
              subjects.rtcIncomingMessageSubject.next(message)
              return undefined
            })
            .mapErr((error) => {
              logger.error(error)
              return subjects.rtcOutgoingErrorMessageSubject.next({
                packageType: 'receiveMessageError',
                messageId: chunked.metaData.messageId,
                error: 'messageHashesMismatch',
              })
            })
        )
      )
    })
  )
