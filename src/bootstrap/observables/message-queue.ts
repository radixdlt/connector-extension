import { rtcOutgoingMessage } from 'webrtc/observables/rtc-outgoing-message'
import loglevel from 'loglevel'
import { MessageSubjectsType } from 'messages/subjects'
import { tap, concatMap, filter, merge, of, first } from 'rxjs'
import { WebRtcSubjectsType } from 'webrtc/subjects'

export const messageQueue = (
  messageSubjects: MessageSubjectsType,
  webRtcSubjects: WebRtcSubjectsType
) =>
  messageSubjects.addMessageSubject.pipe(
    tap(() => loglevel.info(`💺 added to message queue`)),
    concatMap((message) =>
      webRtcSubjects.rtcStatusSubject.pipe(
        filter((status) => status === 'connected'),
        concatMap(() =>
          merge(
            rtcOutgoingMessage(webRtcSubjects),
            of(true).pipe(
              tap(() => {
                loglevel.info(`🛫 processing message`)
                webRtcSubjects.rtcOutgoingMessageSubject.next(
                  JSON.stringify(message)
                )
              }),
              filter(() => false)
            )
          )
        ),
        first(),
        tap((message) => {
          loglevel.info(`🛬 processed message\n${JSON.stringify(message)}`)
        })
      )
    )
  )
