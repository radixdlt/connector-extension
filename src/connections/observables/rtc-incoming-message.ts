import { SubjectsType } from 'connections/subjects'
import { exhaustMap, filter, first, tap, map, share } from 'rxjs'
import { Chunked } from 'connections/data-chunking'
import log from 'loglevel'
import { ok, err } from 'neverthrow'
import { ChunkedMessageType } from 'connections/data-chunking'
import { parseJSON } from 'utils'
import { toBuffer } from 'utils/to-buffer'

export const rtcParsedIncomingMessage = (subjects: SubjectsType) =>
  subjects.rtcIncomingChunkedMessageSubject.pipe(
    // TODO: add runtime message validation
    map((rawMessage) => {
      const message = toBuffer(rawMessage).toString('utf-8')
      log.debug(
        `⬇️ incoming data channel message:\nsize: ${message.length} Bytes\n${message}`
      )
      return parseJSON<ChunkedMessageType>(message)
    }),
    share()
  )

export const rtcIncomingMessage = (subjects: SubjectsType) =>
  rtcParsedIncomingMessage(subjects).pipe(
    exhaustMap((messageResult) => {
      const chunkedResult = messageResult.andThen((message) =>
        message.packageType === 'metaData'
          ? ok(Chunked(message))
          : err(Error(`expected metaData got '${message.packageType}'`))
      )
      if (chunkedResult.isErr()) return [chunkedResult]
      const chunked = chunkedResult.value

      return rtcParsedIncomingMessage(subjects).pipe(
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
              log.error(error)
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
