import { combineLatest, tap } from 'rxjs'
import { SignalingSubjectsType } from 'connector/signaling/subjects'
import { WebRtcSubjectsType } from 'connector/webrtc/subjects'

export const connection = (
  signalingSubjects: SignalingSubjectsType,
  webRtcSubjects: WebRtcSubjectsType
) =>
  combineLatest([
    webRtcSubjects.rtcStatusSubject,
    signalingSubjects.wsConnectSubject,
  ]).pipe(
    tap(([webRtcStatus, shouldSignalingServerConnect]) => {
      if (webRtcStatus === 'connected' && shouldSignalingServerConnect) {
        signalingSubjects.wsConnectSubject.next(false)
      }
    })
  )
