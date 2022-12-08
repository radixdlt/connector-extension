import { filter, withLatestFrom, tap } from 'rxjs'
import { ConnectorSubscriptionsInput } from 'connector/_types'

export const wsConnect = (input: ConnectorSubscriptionsInput) => {
  const signalingSubjects = input.signalingServerClient.subjects
  const webRtcSubjects = input.webRtcClient.subjects

  return webRtcSubjects.rtcAddMessageToQueueSubject.pipe(
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
}
