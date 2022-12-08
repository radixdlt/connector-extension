import { rtcOutgoingMessage } from './rtc-outgoing-message'
import { Logger } from 'loglevel'
import { tap, concatMap, filter, merge, of, first } from 'rxjs'
import { WebRtcSubjectsType } from 'connector/webrtc/subjects'
import { rtcParsedIncomingMessage } from './rtc-incoming-message'

const sendMessage = (
  message: any,
  webRtcSubjects: WebRtcSubjectsType,
  logger: Logger
) =>
  of(true).pipe(
    tap(() => {
      logger.debug(
        `📱💬⬆️ sending message to wallet\n${JSON.stringify(message)}`
      )
      webRtcSubjects.rtcOutgoingMessageSubject.next(
        typeof message === 'string' ? message : JSON.stringify(message)
      )
    }),
    filter((value): value is never => false)
  )

const sendMessageAndWaitForResponse = (
  message: any,
  webRtcSubjects: WebRtcSubjectsType,
  logger: Logger
) =>
  merge(
    rtcOutgoingMessage(
      webRtcSubjects,
      rtcParsedIncomingMessage(webRtcSubjects, logger),
      logger
    ),
    sendMessage(message, webRtcSubjects, logger)
  )

const messageQueue = (webRtcSubjects: WebRtcSubjectsType, logger: Logger) =>
  webRtcSubjects.rtcAddMessageToQueueSubject.pipe(
    tap((message) =>
      logger.debug(`🕸💬⏸ message added to queue\n${JSON.stringify(message)}`)
    )
  )

const retryMessage = (webRtcSubjects: WebRtcSubjectsType, logger: Logger) =>
  webRtcSubjects.rtcSendMessageRetrySubject.pipe(
    tap((message) =>
      logger.debug(
        `🕸💬🔄 failed to send message retrying... \n${JSON.stringify(message)}`
      )
    )
  )

export const rtcMessageQueue = (
  webRtcSubjects: WebRtcSubjectsType,
  logger: Logger
) =>
  merge(
    messageQueue(webRtcSubjects, logger),
    retryMessage(webRtcSubjects, logger)
  ).pipe(
    concatMap((message) =>
      webRtcSubjects.rtcStatusSubject.pipe(
        filter((status) => status === 'connected'),
        concatMap(() =>
          sendMessageAndWaitForResponse(message, webRtcSubjects, logger)
        ),
        first(),
        tap((result) => {
          result
            .map(() =>
              logger.debug(
                `📱💬⬇️ wallet confirmed message\n${JSON.stringify(message)}`
              )
            )
            .mapErr((error) => {
              if (typeof error === 'string' && error === 'timeout') {
                webRtcSubjects.rtcSendMessageRetrySubject.next(message)
              }
            })
        })
      )
    )
  )
