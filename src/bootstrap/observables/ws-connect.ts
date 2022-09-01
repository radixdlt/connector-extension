import { filter, withLatestFrom, tap } from 'rxjs'
import { SignalingSubjectsType } from 'signaling/subjects'
import { WebRtcSubjectsType } from 'webrtc/subjects'

export const wsConnect = (
  webRtcSubjects: WebRtcSubjectsType,
  signalingSubjects: SignalingSubjectsType
) =>
  webRtcSubjects.rtcAddMessageToQueue.pipe(
    withLatestFrom(
      webRtcSubjects.rtcStatusSubject,
      signalingSubjects.wsStatusSubject
    ),
    filter(
      ([, rtcStatus, wsStatus]) =>
        rtcStatus !== 'connected' && wsStatus !== 'connected'
    ),
    tap(() => {
      signalingSubjects.wsConnectSubject.next(true)
    })
  )
