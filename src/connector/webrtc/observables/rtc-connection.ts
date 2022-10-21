import { WebRtcSubjectsType } from 'connector/webrtc/subjects'
import { PeerConnectionType } from 'connector/webrtc/peer-connection'
import { combineLatest, tap } from 'rxjs'

export const rtcConnection = (
  subjects: WebRtcSubjectsType,
  getPeerConnection: () => PeerConnectionType | undefined,
  createPeerConnection: () => void,
  destroyPeerConnection: () => void
  // eslint-disable-next-line max-params
) =>
  combineLatest([subjects.rtcConnectSubject, subjects.rtcStatusSubject]).pipe(
    tap(([shouldConnect, rtcStatusSubject]) => {
      const peerConnectionInstance = getPeerConnection()
      if (
        shouldConnect &&
        !peerConnectionInstance &&
        rtcStatusSubject === 'disconnected'
      ) {
        createPeerConnection()
      } else if (
        !shouldConnect &&
        peerConnectionInstance &&
        rtcStatusSubject !== 'disconnected'
      ) {
        destroyPeerConnection()
      } else if (
        shouldConnect &&
        peerConnectionInstance &&
        rtcStatusSubject === 'disconnected'
      ) {
        subjects.rtcRestartSubject.next()
      }
    })
  )
