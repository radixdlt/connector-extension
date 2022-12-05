import log from 'loglevel'
import { withLatestFrom, tap, merge, filter } from 'rxjs'
import { ConnectorSubscriptionsInput } from 'connector/_types'

export const rtcRestart = (input: ConnectorSubscriptionsInput) => {
  const signalingSubjects = input.signalingServerClient.subjects
  const webRtcSubjects = input.webRtcClient.subjects

  const forceRestart$ = webRtcSubjects.rtcRestartSubject

  const restartActiveConnectionWhenConnectionPasswordChanged$ =
    input.storageClient.subjects.onPasswordChange.pipe(
      withLatestFrom(webRtcSubjects.rtcStatusSubject),
      filter(([_, status]) => status !== 'disconnected')
    )

  return merge(
    forceRestart$,
    restartActiveConnectionWhenConnectionPasswordChanged$
  ).pipe(
    withLatestFrom(signalingSubjects.wsSourceSubject),
    tap(([, source]) => {
      log.debug(`🕸🔄 [${source}] restarting webRTC...`)
      input.webRtcClient.createPeerConnection()
      signalingSubjects.wsConnectSubject.next(true)
    })
  )
}
