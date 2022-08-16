import { SubjectsType } from 'connections/subjects'
import { PeerConnectionAndDataChannelType } from 'connections/webrtc-peer-connection'
import { combineLatest, tap } from 'rxjs'

export const rtcConnection = (
  subjects: SubjectsType,
  getPeerConnection: () => PeerConnectionAndDataChannelType | undefined,
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
