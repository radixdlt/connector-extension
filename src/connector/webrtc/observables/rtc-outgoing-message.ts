import { config } from 'config'
import {
  ChunkedMessageType,
  messageToChunked,
} from 'connector/webrtc/data-chunking'
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
  Observable,
} from 'rxjs'
import { toBuffer } from 'utils/to-buffer'

const dataChannelConfirmation = (
  messageIdResult: Result<string, Error>,
  rtcParsedIncomingMessage$: Observable<Result<ChunkedMessageType, Error>>,
  logger: Logger
) =>
  rtcParsedIncomingMessage$.pipe(
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

const prepareAndSendMessage = (
  rawMessage: string,
  subjects: WebRtcSubjectsType
) =>
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
  )

const messageTimeout = (result: Result<string, Error>, logger: Logger) =>
  timer(config.webRTC.confirmationTimeout).pipe(
    map(() =>
      result.andThen((messageId) => {
        logger.debug(
          `🕸💬❌ confirmation message timeout for messageId:\n'${messageId}'`
        )
        return err('timeout')
      })
    )
  )

const waitForMessageConfirmation = (
  result: Result<string, Error>,
  rtcParsedIncomingMessage$: Observable<Result<ChunkedMessageType, Error>>,
  logger: Logger
) =>
  merge(
    dataChannelConfirmation(result, rtcParsedIncomingMessage$, logger),
    messageTimeout(result, logger)
  )

export const rtcOutgoingMessage = (
  subjects: WebRtcSubjectsType,
  rtcParsedIncomingMessage$: Observable<Result<ChunkedMessageType, Error>>,
  logger: Logger
) =>
  subjects.rtcOutgoingMessageSubject.pipe(
    concatMap((rawMessage) =>
      prepareAndSendMessage(rawMessage, subjects).pipe(
        mergeMap((result) =>
          waitForMessageConfirmation(result, rtcParsedIncomingMessage$, logger)
        ),
        first()
      )
    )
  )
