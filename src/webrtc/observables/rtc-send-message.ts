import { WebRtcSubjectsType } from 'webrtc/subjects'
import log from 'loglevel'
import { map, merge, tap } from 'rxjs'

export const rtcSendMessage = (
  subjects: WebRtcSubjectsType,
  sendMessage: (message: string) => void
) =>
  merge(
    subjects.rtcOutgoingChunkedMessageSubject,
    subjects.rtcOutgoingErrorMessageSubject.pipe(
      map((message) => JSON.stringify(message))
    ),
    subjects.rtcOutgoingConfirmationMessageSubject.pipe(
      tap((message) => {
        log.debug(
          `👌 sending webRTC data channel confirmation for messageId: ${message.messageId}`
        )
      }),
      map((message) => JSON.stringify(message))
    )
  ).pipe(tap(sendMessage))
