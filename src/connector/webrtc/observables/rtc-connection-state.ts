import { WebRtcSubjectsType } from 'connector/webrtc/subjects'
import { tap, distinctUntilChanged, filter } from 'rxjs'

export const rtcIceConnectionState = (
  subjects: WebRtcSubjectsType,
  closePeerConnection: () => void
) =>
  subjects.rtcIceConnectionStateSubject.pipe(
    distinctUntilChanged(),
    filter((rtcIceConnectionState) =>
      ['failed', 'disconnected'].includes(rtcIceConnectionState || '')
    ),
    tap(() => {
      closePeerConnection()
    })
  )
