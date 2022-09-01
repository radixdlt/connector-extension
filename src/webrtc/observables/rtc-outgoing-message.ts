import { config } from 'config'
import { messageToChunked } from 'webrtc/data-chunking'
import { WebRtcSubjectsType } from 'webrtc/subjects'
import { Logger } from 'loglevel'
import { track } from 'mixpanel'
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
        track('webrtc_message_send_confirmed', { messageId })
        return logger.debug(
          `👌 received message confirmation for messageId: '${messageId}'`
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
        messageToChunked(toBuffer(rawMessage), logger).map((message) => {
          track('webrtc_message_send', {
            messageId: message.metaData.messageId,
            size: rawMessage.length,
          })
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
                  track('webrtc_message_send_failed', {
                    reason: 'timeout',
                    messageId,
                  })
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
