import { SubjectsType } from 'connections/subjects'
import log from 'loglevel'
import { withLatestFrom, tap, distinctUntilChanged, filter } from 'rxjs'

export const rtcRestart = (
  subjects: SubjectsType,
  createPeerConnectionAndDataChannel: () => void
) =>
  subjects.rtcRestartSubject.pipe(
    withLatestFrom(subjects.wsSourceSubject),
    tap(([, wsSourceSubject]) => {
      log.debug(`🔄 [${wsSourceSubject}] restarting webRTC...`)
      createPeerConnectionAndDataChannel()
      subjects.wsConnectSubject.next(true)
    })
  )

export const rtcIceConnectionState = (
  subjects: SubjectsType,
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
