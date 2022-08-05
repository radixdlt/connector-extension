import log from 'loglevel'
import { ResultAsync } from 'neverthrow'
import { concatMap, Subscription, switchMap, tap } from 'rxjs'
import { errorIdentity } from 'utils/error-identity'
import { subjects as allSubjects } from '../subjects'

export const WebRtc = ({
  peerConnectionConfig,
  dataChannelConfig,
  subjects,
}: {
  peerConnectionConfig: RTCConfiguration
  dataChannelConfig: RTCDataChannelInit
  subjects: typeof allSubjects
}) => {
  const CreatePeerConnectionAndDataChannel = () => {
    const peerConnection = new RTCPeerConnection(peerConnectionConfig)
    log.debug(`🤌 created webRTC peer connection instance`)
    log.trace(peerConnectionConfig)

    const onicecandidate = (e: RTCPeerConnectionIceEvent) => {
      if (e.candidate) {
        log.info(`🧊 got local ice candidate`)
        subjects.rtcLocalIceCandidateSubject.next(e.candidate)
      }
    }

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
      log.debug(
        `👾 setting local webRTC description: ${sessionDescription.type}`
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
      log.debug(`🗣 creating local webRTC answer`)
      return ResultAsync.fromPromise(
        peerConnection.createAnswer(),
        errorIdentity
      )
    }

    const createPeerConnectionOffer = (): ResultAsync<
      RTCSessionDescriptionInit,
      Error
    > => {
      log.debug(`🗣 creating local webRTC offer`)
      return ResultAsync.fromPromise(
        peerConnection.createOffer(),
        errorIdentity
      )
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
      log.debug(`⬇️ incoming data channel message`)
      subjects.rtcIncomingMessageSubject.next(ev)
    }

    const onopen = () => {
      log.debug(`🔊 webRTC data channel open`)
      subjects.rtcStatusSubject.next('open')
    }

    const onclose = () => {
      log.debug(`🔇 webRTC data channel closed`)
      subjects.rtcStatusSubject.next('closed')
    }

    dataChannel.onmessage = onmessage
    dataChannel.onopen = onopen
    dataChannel.onclose = onclose

    const sendMessage = (message: string) => {
      log.debug(`⬆️ outgoing data channel message`)
      log.trace(message)
      dataChannel.send(message)
    }

    const destroy = () => {
      log.debug(`🧹 destroying webRTC instance`)
      subscriptions.unsubscribe()
      dataChannel.close()
      peerConnection.close()
      peerConnection.removeEventListener('icecandidate', onicecandidate)
      dataChannel.removeEventListener('message', onmessage)
      dataChannel.removeEventListener('open', onopen)
      dataChannel.removeEventListener('close', onclose)
    }

    const subscriptions = new Subscription()

    subscriptions.add(
      subjects.rtcRemoteIceCandidateSubject
        .pipe(
          concatMap((iceCandidate) => {
            log.debug(`🧊 adding incoming ice candidate`)
            return addIceCandidate(new RTCIceCandidate(iceCandidate))
          }),
          tap((result) => {
            // TODO: handle error
            if (result.isErr()) log.error(result.error)
          })
        )
        .subscribe()
    )

    subscriptions.add(
      subjects.rtcRemoteOfferSubject
        .pipe(
          switchMap((offer) =>
            setRemoteDescription(offer)
              .andThen(createPeerConnectionAnswer)
              .andThen(setLocalDescription)
          ),
          tap((result) => {
            // TODO: handle error
            if (result.isErr()) {
              return log.error(result.error)
            }
            subjects.rtcLocalAnswerSubject.next(result.value)
          })
        )
        .subscribe()
    )

    subscriptions.add(
      subjects.rtcRemoteAnswerSubject
        .pipe(
          switchMap((answer) => setRemoteDescription(answer)),
          tap((result) => {
            // TODO: handle error
            if (result.isErr()) {
              return log.error(result.error)
            }
          })
        )
        .subscribe()
    )

    subscriptions.add(
      subjects.rtcCreateOfferSubject
        .pipe(
          switchMap(() =>
            createPeerConnectionOffer().andThen(setLocalDescription)
          ),
          tap((result) => {
            // TODO: handle error
            if (result.isErr()) {
              return log.error(result.error)
            }
            subjects.rtcLocalOfferSubject.next(result.value)
          })
        )
        .subscribe()
    )

    subscriptions.add(
      subjects.rtcOutgoingMessageSubject.pipe(tap(sendMessage)).subscribe()
    )

    return { peerConnection, dataChannel, destroy }
  }

  let peerConnection: ReturnType<typeof CreatePeerConnectionAndDataChannel>

  const subscriptions = new Subscription()

  subscriptions.add(
    subjects.rtcConnectSubject
      .pipe(
        tap((shouldConnect) => {
          if (shouldConnect && !peerConnection) {
            peerConnection = CreatePeerConnectionAndDataChannel()
          }
        })
      )
      .subscribe()
  )

  const destroy = () => {
    subscriptions.unsubscribe()
    if (peerConnection) {
      peerConnection.destroy()
    }
  }

  return { CreatePeerConnectionAndDataChannel, destroy }
}
