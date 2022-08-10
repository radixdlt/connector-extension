import { SubjectsType } from 'connections/subjects'
import { combineLatest, tap } from 'rxjs'

export const wsConnection = (subjects: SubjectsType) =>
  combineLatest([subjects.rtcStatusSubject, subjects.wsConnectSubject]).pipe(
    tap(([webRtcStatus, shouldSignalingServerConnect]) => {
      if (webRtcStatus === 'connected' && shouldSignalingServerConnect) {
        subjects.wsConnectSubject.next(false)
      }
    })
  )
