import { rtcOutgoingMessage } from './rtc-outgoing-message'
import { Logger } from 'loglevel'
import { tap, concatMap, filter, merge, of, first } from 'rxjs'
import { WebRtcSubjectsType } from 'webrtc/subjects'

export const rtcMessageQueue = (
  webRtcSubjects: WebRtcSubjectsType,
  logger: Logger
) =>
  webRtcSubjects.rtcAddMessageToQueue.pipe(
    tap((message) =>
      logger.info(`📱💬⏸ message added to queue\n${JSON.stringify(message)}`)
    ),
    concatMap((message) =>
      webRtcSubjects.rtcStatusSubject.pipe(
        filter((status) => status === 'connected'),
        concatMap(() =>
          merge(
            rtcOutgoingMessage(webRtcSubjects, logger),
            of(true).pipe(
              tap(() => {
                logger.info(
                  `📱💬⬆️ sending message to wallet\n${JSON.stringify(message)}`
                )
                webRtcSubjects.rtcOutgoingMessageSubject.next(
                  typeof message === 'string'
                    ? message
                    : JSON.stringify(message)
                )
              }),
              filter(() => false)
            )
          )
        ),
        first(),
        tap((result) => {
          if (typeof result === 'boolean') return

          result.map(() =>
            logger.info(
              `📱💬⬇️ wallet confirmed message\n${JSON.stringify(message)}`
            )
          )
        })
      )
    )
  )
