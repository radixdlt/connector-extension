import { Logger } from 'loglevel'
import { ResultAsync } from 'neverthrow'
import { Subscription } from 'rxjs'
import { errorIdentity } from 'utils/error-identity'
import { track } from 'mixpanel'
import {
  rtcRemoteIceCandidate,
  rtcRemoteOfferSubject,
  rtcRemoteAnswer,
} from './observables/rtc-remote'
import { rtcCreateOffer } from './observables/rtc-create-offer'
import { rtcSendMessage } from './observables/rtc-send-message'
import { WebRtcSubjectsType } from './subjects'

export type PeerConnectionType = ReturnType<typeof PeerConnection>

export const PeerConnection = (
  subjects: WebRtcSubjectsType,
  peerConnectionConfig: RTCConfiguration,
  dataChannelConfig: RTCDataChannelInit,
  logger: Logger
  // eslint-disable-next-line max-params
) => {
  track('webrtc_connecting')
  subjects.rtcStatusSubject.next('connecting')
  const peerConnection = new RTCPeerConnection(peerConnectionConfig)
  logger.debug(`🕸 created webRTC peer connection instance`)
  logger.trace(peerConnectionConfig)

  const onicecandidate = (e: RTCPeerConnectionIceEvent) => {
    if (e.candidate) {
      logger.debug(`🕸⬆️🧊 got local ice candidate`)
      subjects.rtcLocalIceCandidateSubject.next(e.candidate)
    }
  }

  const oniceconnectionstatechange = () => {
    logger.debug(`🕸🧊 iceConnectionState: ${peerConnection.iceConnectionState}`)
    subjects.rtcIceConnectionStateSubject.next(
      peerConnection.iceConnectionState
    )
  }

  peerConnection.oniceconnectionstatechange = oniceconnectionstatechange

  peerConnection.onicecandidate = onicecandidate

  const setRemoteDescription = (
    sessionDescription: RTCSessionDescriptionInit
  ): ResultAsync<void, Error> => {
    logger.trace(
      `🕸👾 setting remote webRTC description: ${sessionDescription.type}`
    )
    logger.trace(sessionDescription)
    return ResultAsync.fromPromise(
      peerConnection.setRemoteDescription(sessionDescription),
      errorIdentity
    )
  }

  const setLocalDescription = (
    sessionDescription: RTCSessionDescriptionInit
  ) => {
    logger.trace(
      `🕸👊 setting local webRTC description: ${sessionDescription.type}`
    )
    return ResultAsync.fromPromise(
      peerConnection.setLocalDescription(sessionDescription),
      errorIdentity
    ).map(() => sessionDescription)
  }

  const createPeerConnectionAnswer = (): ResultAsync<
    RTCSessionDescriptionInit,
    Error
  > => {
    logger.debug(`🕸⬆️🤛 creating answer`)
    return ResultAsync.fromPromise(peerConnection.createAnswer(), errorIdentity)
  }

  const createPeerConnectionOffer = (): ResultAsync<
    RTCSessionDescriptionInit,
    Error
  > => {
    logger.debug(`🕸⬆️🤜 creating offer`)
    return ResultAsync.fromPromise(peerConnection.createOffer(), errorIdentity)
  }

  const addIceCandidate = (iceCandidate: RTCIceCandidateInit) =>
    ResultAsync.fromPromise(
      peerConnection.addIceCandidate(iceCandidate),
      errorIdentity
    )

  const dataChannel = peerConnection.createDataChannel(
    'data',
    dataChannelConfig
  )

  const onmessage = (ev: MessageEvent<ArrayBuffer | string>) => {
    subjects.rtcIncomingChunkedMessageSubject.next(ev.data)
  }

  const onopen = () => {
    logger.debug(`🕸🟢 webRTC data channel open`)
    track('webrtc_connected')
    subjects.rtcStatusSubject.next('connected')
  }

  const onclose = () => {
    logger.debug(`🕸🔴 webRTC data channel closed`)
    subjects.rtcStatusSubject.next('disconnected')
  }

  dataChannel.onmessage = onmessage
  dataChannel.onopen = onopen
  dataChannel.onclose = onclose

  const sendMessage = (message: string) => {
    logger.debug(
      `🕸⬆️🔪💬 sending chunked message:\nsize: ${message.length} Bytes\n${message}`
    )
    dataChannel.send(message)
  }

  const destroy = () => {
    logger.debug(`🧹 destroying webRTC instance`)
    subscriptions.unsubscribe()
    dataChannel.close()
    peerConnection.close()
    peerConnection.removeEventListener('icecandidate', onicecandidate)
    peerConnection.removeEventListener(
      'iceconnectionstatechange',
      oniceconnectionstatechange
    )
    dataChannel.removeEventListener('message', onmessage)
    dataChannel.removeEventListener('open', onopen)
    dataChannel.removeEventListener('close', onclose)

    track('webrtc_disconnected')
  }

  const subscriptions = new Subscription()
  subscriptions.add(
    rtcRemoteIceCandidate(subjects, addIceCandidate, logger).subscribe()
  )
  subscriptions.add(
    rtcRemoteOfferSubject(
      subjects,
      setRemoteDescription,
      createPeerConnectionAnswer,
      setLocalDescription,
      logger
    ).subscribe()
  )
  subscriptions.add(
    rtcRemoteAnswer(subjects, setRemoteDescription, logger).subscribe()
  )
  subscriptions.add(
    rtcCreateOffer(
      subjects,
      createPeerConnectionOffer,
      setLocalDescription,
      logger
    ).subscribe()
  )
  subscriptions.add(rtcSendMessage(subjects, sendMessage, logger).subscribe())

  return { peerConnection, dataChannel, destroy }
}
