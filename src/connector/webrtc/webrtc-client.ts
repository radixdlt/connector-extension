import { Logger } from 'loglevel'
import { WebRtcSubscriptions } from 'connector/webrtc/subscriptions'
import { PeerConnectionType, PeerConnection } from './peer-connection'
import { WebRtcSubjectsType } from './subjects'

export type WebRtcClientType = ReturnType<typeof WebRtcClient>
export type WebRtcClientInput = {
  logger: Logger
  peerConnectionConfig: RTCConfiguration
  dataChannelConfig: RTCDataChannelInit
  subjects: WebRtcSubjectsType
}
export const WebRtcClient = (input: WebRtcClientInput) => {
  const subjects = input.subjects

  let peerConnectionInstance: PeerConnectionType | undefined

  const createPeerConnection = () => {
    peerConnectionInstance?.destroy()
    peerConnectionInstance = PeerConnection(
      subjects,
      input.peerConnectionConfig,
      input.dataChannelConfig,
      input.logger
    )
  }

  const closePeerConnection = () => {
    peerConnectionInstance?.peerConnection.close()
    peerConnectionInstance?.dataChannel.close()
  }

  const getPeerConnectionInstance = () => peerConnectionInstance

  const destroyPeerConnectionInstance = () => {
    if (peerConnectionInstance) {
      peerConnectionInstance.destroy()
    }
  }

  const dependencies = {
    closePeerConnection,
    createPeerConnection,
    destroy: destroyPeerConnectionInstance,
    getPeerConnectionInstance,
  }

  const subscriptions = WebRtcSubscriptions(
    subjects,
    dependencies,
    input.logger
  )

  const destroy = () => {
    subjects.rtcConnectSubject.next(false)
    destroyPeerConnectionInstance()
    subscriptions.unsubscribe()
  }

  return {
    subjects,
    destroy,
    createPeerConnection,
  }
}
