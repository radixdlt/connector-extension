import log, { Logger } from 'loglevel'
import { WebRtcSubscriptions } from 'connector/webrtc/subscriptions'
import { PeerConnectionType, PeerConnection } from './peer-connection'
import { WebRtcSubjectsType, WebRtcSubjects } from './subjects'
import { config } from 'config'

export type WebRtcClientType = ReturnType<typeof WebRtcClient>
export type WebRtcClientInput = {
  logger?: Logger
  peerConnectionConfig?: RTCConfiguration
  dataChannelConfig?: RTCDataChannelInit
  subjects?: WebRtcSubjectsType
}
export const WebRtcClient = ({
  peerConnectionConfig = config.webRTC.peerConnectionConfig,
  dataChannelConfig = config.webRTC.dataChannelConfig,
  subjects = WebRtcSubjects(),
  logger = log,
}: WebRtcClientInput) => {
  let peerConnectionInstance: PeerConnectionType | undefined

  const createPeerConnection = () => {
    peerConnectionInstance?.destroy()
    peerConnectionInstance = PeerConnection(
      subjects,
      peerConnectionConfig,
      dataChannelConfig,
      logger
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

  const subscriptions = WebRtcSubscriptions(subjects, dependencies, logger)

  const destroy = () => {
    subjects.rtcConnectSubject.next(false)
    destroyPeerConnectionInstance()
    subscriptions.unsubscribe()
  }

  return {
    connect: (value: boolean) => subjects.rtcConnectSubject.next(value),
    subjects,
    destroy,
    createPeerConnection,
  }
}
