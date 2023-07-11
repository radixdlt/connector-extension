import { SignalingClientType } from 'connector/signaling/signaling-client'
import { Answer, MessageSources, Offer } from 'io-types/types'
import { ResultAsync } from 'neverthrow'
import { mergeMap, Subscription, switchMap } from 'rxjs'
import { Logger } from 'tslog'
import { errorIdentity } from 'utils/error-identity'
import { WebRtcSubjectsType } from './subjects'

export const PeerConnectionClient = (input: {
  subjects: WebRtcSubjectsType
  peerConnection: RTCPeerConnection
  logger?: Logger<unknown>
  shouldCreateOffer: boolean
  source: MessageSources
  signalingClient: SignalingClientType
  restart: () => void
}) => {
  const peerConnection = input.peerConnection
  const subjects = input.subjects
  const logger = input.logger
  const subscriptions = new Subscription()

  const signalingClient = input.signalingClient
  const onRemoteOffer$ = signalingClient.onOffer$
  const onRemoteAnswer$ = signalingClient.onAnswer$

  const onNegotiationNeeded = async () => {
    if (input.shouldCreateOffer)
      subscriptions.add(
        signalingClient.remoteClientConnected$
          .pipe(
            switchMap(() =>
              createOffer()
                .andThen(setLocalDescription)
                .map(() => peerConnection.localDescription!)
                .map(({ sdp }) => ({
                  method: 'offer' as Offer['method'],
                  payload: { sdp },
                  source: input.source,
                }))
                .map((offer) => subjects.offerSubject.next(offer)),
            ),
          )
          .subscribe(),
      )
  }

  const onSignalingStateChange = () => {
    logger?.debug(`🕸🏛 signalingState: ${peerConnection.signalingState}`)
    subjects.onSignalingStateChangeSubject.next(peerConnection.signalingState)
  }

  peerConnection.onnegotiationneeded = onNegotiationNeeded
  peerConnection.onsignalingstatechange = onSignalingStateChange

  const setLocalDescription = (description: RTCSessionDescriptionInit) =>
    ResultAsync.fromPromise(
      peerConnection.setLocalDescription(description),
      errorIdentity,
    ).map(() => peerConnection.localDescription!)

  const setRemoteDescription = (description: RTCSessionDescriptionInit) =>
    ResultAsync.fromPromise(
      peerConnection.setRemoteDescription(description),
      errorIdentity,
    )

  const createAnswer = () =>
    ResultAsync.fromPromise(peerConnection.createAnswer(), errorIdentity)

  const createOffer = () =>
    ResultAsync.fromPromise(peerConnection.createOffer(), errorIdentity)

  subscriptions.add(
    onRemoteOffer$
      .pipe(
        switchMap((offer) =>
          setRemoteDescription(offer)
            .andThen(createAnswer)
            .andThen(setLocalDescription)
            .map(({ sdp }) => ({
              method: 'answer' as Answer['method'],
              payload: { sdp },
              source: input.source,
            }))
            .map((answer) => subjects.answerSubject.next(answer)),
        ),
      )
      .subscribe(),
  )

  subscriptions.add(
    onRemoteAnswer$.pipe(mergeMap(setRemoteDescription)).subscribe(),
  )

  return {
    destroy: () => {
      peerConnection.removeEventListener(
        'signalingstatechange',
        onSignalingStateChange,
      )
      peerConnection.removeEventListener(
        'onnegotiationneeded',
        onNegotiationNeeded,
      )
      peerConnection.close()
      subscriptions.unsubscribe()
    },
  }
}
