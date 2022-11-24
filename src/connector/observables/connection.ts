import { combineLatest, tap } from 'rxjs'
import { ConnectorSubscriptionsInput } from 'connector/_types'

export const connection = (input: ConnectorSubscriptionsInput) =>
  combineLatest([
    input.webRtcClient.subjects.rtcStatusSubject,
    input.signalingServerClient.subjects.wsConnectSubject,
  ]).pipe(
    tap(([webRtcStatus, shouldSignalingServerConnect]) => {
      if (webRtcStatus === 'connected' && shouldSignalingServerConnect) {
        input.signalingServerClient.subjects.wsConnectSubject.next(false)
      }
    })
  )
