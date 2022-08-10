import log from 'loglevel'
import { ResultAsync } from 'neverthrow'
import {
  combineLatest,
  concatMap,
  map,
  merge,
  Subscription,
  switchMap,
  tap,
  withLatestFrom,
  distinctUntilChanged,
  filter,
} from 'rxjs'
import { errorIdentity } from 'utils/error-identity'
import { SubjectsType } from 'connections/subjects'

export const WebRtc = ({
  peerConnectionConfig,
  dataChannelConfig,
  subjects,
}: {
  peerConnectionConfig: RTCConfiguration
  dataChannelConfig: RTCDataChannelInit
  subjects: SubjectsType
}) => {
  const CreatePeerConnectionAndDataChannel = () => {
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
      subjects.rtcIncomingChunkedMessageSubject.next(ev.data)
    }

    const onopen = () => {
      log.debug(`🔊 webRTC data channel open`)
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
      peerConnectionInstance = undefined
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
      merge(
        subjects.rtcOutgoingChunkedMessageSubject,
        subjects.rtcOutgoingErrorMessageSubject.pipe(
          map((message) => JSON.stringify(message))
        ),
        subjects.rtcOutgoingConfirmationMessageSubject.pipe(
          tap((message) => {
            log.debug(
              `👌 sending webRTC data channel confirmation for messageId: ${message.messageId}`
            )
          }),
          map((message) => JSON.stringify(message))
        )
      )
        .pipe(tap(sendMessage))
        .subscribe()
    )

    return { peerConnection, dataChannel, destroy }
  }

  const destroy = () => {
    subscriptions.unsubscribe()
    if (peerConnectionInstance) {
      peerConnectionInstance.destroy()
    }
  }

  let peerConnectionInstance:
    | ReturnType<typeof CreatePeerConnectionAndDataChannel>
    | undefined

  const subscriptions = new Subscription()

  const rtcRestart = (subjects: SubjectsType) =>
    subjects.rtcIceConnectionStateSubject.pipe(
      distinctUntilChanged(),
      filter((rtcIceConnectionState) =>
        ['failed', 'disconnected'].includes(rtcIceConnectionState || '')
      ),
      tap(() => {
        peerConnectionInstance?.dataChannel.close()
      })
    )

  subscriptions.add(rtcRestart(subjects).subscribe())

  subscriptions.add(
    combineLatest([subjects.rtcConnectSubject, subjects.rtcStatusSubject])
      .pipe(
        tap(([shouldConnect, rtcStatusSubject]) => {
          if (
            shouldConnect &&
            !peerConnectionInstance &&
            rtcStatusSubject === 'disconnected'
          ) {
            peerConnectionInstance = CreatePeerConnectionAndDataChannel()
          } else if (
            !shouldConnect &&
            peerConnectionInstance &&
            rtcStatusSubject !== 'disconnected'
          ) {
            peerConnectionInstance.destroy()
          } else if (
            shouldConnect &&
            peerConnectionInstance &&
            rtcStatusSubject === 'disconnected'
          ) {
            subjects.rtcRestartSubject.next()
          }
        })
      )
      .subscribe()
  )

  subscriptions.add(
    subjects.rtcRestartSubject
      .pipe(
        withLatestFrom(subjects.wsSourceSubject),
        tap(([, wsSourceSubject]) => {
          log.debug(`🔄 [${wsSourceSubject}] restarting webRTC...`)
          peerConnectionInstance?.destroy()
          peerConnectionInstance = CreatePeerConnectionAndDataChannel()
          subjects.wsConnectSubject.next(true)
        })
      )
      .subscribe()
  )

  return {
    CreatePeerConnectionAndDataChannel,
    destroy,
    getPeerConnection: () => peerConnectionInstance,
  }
}
