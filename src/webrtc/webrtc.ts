import { WebRtcSubjectsType } from 'webrtc/subjects'
import { PeerConnection, PeerConnectionType } from './peer-connection'

export type WebRtcType = ReturnType<typeof WebRtc>
export const WebRtc = ({
  peerConnectionConfig,
  dataChannelConfig,
  subjects,
}: {
  peerConnectionConfig: RTCConfiguration
  dataChannelConfig: RTCDataChannelInit
  subjects: WebRtcSubjectsType
}) => {
  let peerConnectionInstance: PeerConnectionType | undefined

  const createPeerConnection = () => {
    peerConnectionInstance?.destroy()
    peerConnectionInstance = PeerConnection(
      subjects,
      peerConnectionConfig,
      dataChannelConfig
    )
  }

  const closePeerConnection = () => {
    peerConnectionInstance?.peerConnection.close()
    peerConnectionInstance?.dataChannel.close()
  }

  const getPeerConnectionInstance = () => peerConnectionInstance

  const destroy = () => {
    if (peerConnectionInstance) {
      peerConnectionInstance.destroy()
    }
  }

  return {
    createPeerConnection,
    closePeerConnection,
    getPeerConnectionInstance,
    destroy,
  }
}
