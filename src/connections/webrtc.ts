import { Subscription } from 'rxjs'
import { WebRtcSubjectsType } from 'connections/subjects'
import {
  PeerConnectionAndDataChannel,
  PeerConnectionAndDataChannelType,
} from './webrtc-peer-connection'
import { rtcRestart, rtcIceConnectionState } from './observables/rtc-restart'
import { rtcConnection } from './observables/rtc-connection'

export const WebRtc = ({
  peerConnectionConfig,
  dataChannelConfig,
  subjects,
}: {
  peerConnectionConfig: RTCConfiguration
  dataChannelConfig: RTCDataChannelInit
  subjects: WebRtcSubjectsType
}) => {
  let peerConnectionInstance: PeerConnectionAndDataChannelType | undefined

  const createPeerConnection = () => {
    peerConnectionInstance?.destroy()
    peerConnectionInstance = PeerConnectionAndDataChannel(
      subjects,
      peerConnectionConfig,
      dataChannelConfig
    )
  }

  const closePeerConnection = () => {
    peerConnectionInstance?.peerConnection.close()
    peerConnectionInstance?.dataChannel.close()
  }

  const destroy = () => {
    subscriptions.unsubscribe()
    if (peerConnectionInstance) {
      peerConnectionInstance.destroy()
    }
  }

  const subscriptions = new Subscription()

  subscriptions.add(
    rtcIceConnectionState(subjects, closePeerConnection).subscribe()
  )

  subscriptions.add(
    rtcConnection(
      subjects,
      () => peerConnectionInstance,
      createPeerConnection,
      destroy
    ).subscribe()
  )

  subscriptions.add(rtcRestart(subjects, createPeerConnection).subscribe())

  return {
    destroy,
  }
}
