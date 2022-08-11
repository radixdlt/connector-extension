import log from 'loglevel'
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
import { SubjectsType } from './subjects'

export type PeerConnectionAndDataChannelType = ReturnType<
  typeof PeerConnectionAndDataChannel
>

export const PeerConnectionAndDataChannel = (
  subjects: SubjectsType,
  peerConnectionConfig: RTCConfiguration,
  dataChannelConfig: RTCDataChannelInit
) => {
  track('webrtc_connecting')
  subjects.rtcStatusSubject.next('connecting')
  const peerConnection = new RTCPeerConnection(peerConnectionConfig)
  log.debug(`🕸 created webRTC peer connection instance`)
  log.trace(peerConnectionConfig)

  const onicecandidate = (e: RTCPeerConnectionIceEvent) => {
    if (e.candidate) {
      log.debug(`🧊 got local ice candidate`)
      subjects.rtcLocalIceCandidateSubject.next(e.candidate)
    }
  }

  const oniceconnectionstatechange = () => {
    log.debug(`🧊 iceConnectionState: ${peerConnection.iceConnectionState}`)
    subjects.rtcIceConnectionStateSubject.next(
      peerConnection.iceConnectionState
    )
  }

  peerConnection.oniceconnectionstatechange = oniceconnectionstatechange

  peerConnection.onicecandidate = onicecandidate

  const setRemoteDescription = (
    sessionDescription: RTCSessionDescriptionInit
  ): ResultAsync<void, Error> => {
    log.debug(
      `👾 setting remote webRTC description: ${sessionDescription.type}`
    )
    log.trace(sessionDescription)
    return ResultAsync.fromPromise(
      peerConnection.setRemoteDescription(sessionDescription),
      errorIdentity
    )
  }

  const setLocalDescription = (
    sessionDescription: RTCSessionDescriptionInit
  ) => {
    log.debug(`👾 setting local webRTC description: ${sessionDescription.type}`)
    return ResultAsync.fromPromise(
      peerConnection.setLocalDescription(sessionDescription),
      errorIdentity
    ).map(() => sessionDescription)
  }

  const createPeerConnectionAnswer = (): ResultAsync<
    RTCSessionDescriptionInit,
    Error
  > => {
    log.debug(`🗣 creating local webRTC answer`)
    return ResultAsync.fromPromise(peerConnection.createAnswer(), errorIdentity)
  }

  const createPeerConnectionOffer = (): ResultAsync<
    RTCSessionDescriptionInit,
    Error
  > => {
    log.debug(`🗣 creating local webRTC offer`)
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

  log.trace(`🤌 created webRTC data channel with`)
  log.trace(dataChannelConfig)

  const onmessage = (ev: MessageEvent<ArrayBuffer | string>) => {
    subjects.rtcIncomingChunkedMessageSubject.next(ev.data)
  }

  const onopen = () => {
    log.debug(`🔊 webRTC data channel open`)
    track('webrtc_connected')
    subjects.rtcStatusSubject.next('connected')
  }

  const onclose = () => {
    log.debug(`🔇 webRTC data channel closed`)
    subjects.rtcStatusSubject.next('disconnected')
  }

  dataChannel.onmessage = onmessage
  dataChannel.onopen = onopen
  dataChannel.onclose = onclose

  const sendMessage = (message: string) => {
    log.debug(
      `⬆️ outgoing data channel message:\nsize: ${message.length} Bytes\n${message}`
    )
    dataChannel.send(message)
  }

  const destroy = () => {
    log.debug(`🧹 destroying webRTC instance`)
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
    rtcRemoteIceCandidate(subjects, addIceCandidate).subscribe()
  )
  subscriptions.add(
    rtcRemoteOfferSubject(
      subjects,
      setRemoteDescription,
      createPeerConnectionAnswer,
      setLocalDescription
    ).subscribe()
  )
  subscriptions.add(rtcRemoteAnswer(subjects, setRemoteDescription).subscribe())
  subscriptions.add(
    rtcCreateOffer(
      subjects,
      createPeerConnectionOffer,
      setLocalDescription
    ).subscribe()
  )
  subscriptions.add(rtcSendMessage(subjects, sendMessage).subscribe())

  return { peerConnection, dataChannel, destroy }
}
