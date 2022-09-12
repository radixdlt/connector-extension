import { combineLatest, tap } from 'rxjs'
import { SignalingSubjectsType } from 'signaling/subjects'
import { WebRtcSubjectsType } from 'webrtc/subjects'

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
