import log from 'loglevel'
import { withLatestFrom, tap } from 'rxjs'
import { ConnectorSubscriptionsInput } from 'connector/_types'

export const rtcRestart = (input: ConnectorSubscriptionsInput) => {
  const signalingSubjects = input.signalingServerClient.subjects
  const webRtcSubjects = input.webRtcClient.subjects

  return webRtcSubjects.rtcRestartSubject.pipe(
    withLatestFrom(signalingSubjects.wsSourceSubject),
    tap(([, source]) => {
      log.debug(`🕸🔄 [${source}] restarting webRTC...`)
      input.webRtcClient.createPeerConnection()
      signalingSubjects.wsConnectSubject.next(true)
    })
  )
}
