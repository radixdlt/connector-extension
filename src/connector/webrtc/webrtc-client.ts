import { config } from 'config'
import { Logger } from 'tslog'
import { DataChannelClient } from './data-channel-client'
import { WebRtcSubjectsType } from './subjects'
import { IceCandidateClient } from './ice-candidate-client'
import { PeerConnectionClient } from './peer-connection-client'
import {
  combineLatest,
  concatMap,
  filter,
  first,
  merge,
  Subject,
  Subscription,
  switchMap,
  tap,
  withLatestFrom,
} from 'rxjs'
import { Message } from 'connector/_types'
import { SignalingClientType } from 'connector/signaling/signaling-client'
import { MessageSources } from 'io-types/types'
import { MessageClientType } from 'connector/messages/message-client'

export type WebRtcClient = ReturnType<typeof WebRtcClient>

export const WebRtcClient = (
  input: typeof config['webRTC'] & {
    shouldCreateOffer: boolean
    logger?: Logger<unknown>
    subjects: WebRtcSubjectsType
    onMessageSubject: Subject<Message>
    signalingClient: SignalingClientType
    source: MessageSources
    messageClient: MessageClientType
    restart: () => void
  }
) => {
  const logger = input.logger
  const subjects = input.subjects
  const restart = input.restart
  const signalingClient = input.signalingClient

  const peerConnection: RTCPeerConnection = new RTCPeerConnection(
    input.peerConnectionConfig
  )

  const dataChannel = peerConnection.createDataChannel(
    'data',
    input.dataChannelConfig
  )

  const peerConnectionClient = PeerConnectionClient({
    peerConnection,
    subjects,
    logger,
    shouldCreateOffer: input.shouldCreateOffer,
    source: input.source,
    signalingClient: input.signalingClient,
    restart: input.restart,
  })

  const dataChannelClient = DataChannelClient({
    dataChannel,
    logger,
    subjects,
    onMessageSubject: input.onMessageSubject,
  })

  const iceCandidateClient = IceCandidateClient({
    logger,
    subjects,
    peerConnection,
    source: input.source,
  })

  const onRemoteIceCandidate$ = input.signalingClient.onIceCandidate$
  const onLocalIceCandidate$ = iceCandidateClient.iceCandidate$
  const onLocalOffer$ = subjects.offerSubject
  const onLocalAnswer$ = subjects.answerSubject

  const subscriptions = new Subscription()

  subscriptions.add(
    merge(onLocalOffer$, onLocalAnswer$, onLocalIceCandidate$)
      .pipe(concatMap(input.signalingClient.sendMessage))
      .subscribe()
  )

  subscriptions.add(
    onRemoteIceCandidate$
      .pipe(
        tap((iceCandidate) =>
          subjects.onRemoteIceCandidateSubject.next(iceCandidate)
        )
      )
      .subscribe()
  )

  subscriptions.add(
    signalingClient.status$
      .pipe(
        filter((status) => status === 'connected'),
        first(),
        switchMap(() =>
          signalingClient.status$.pipe(
            withLatestFrom(dataChannelClient.subjects.dataChannelStatusSubject),
            filter(
              ([signalingServerStatus, dataChannelStatus]) =>
                signalingServerStatus === 'disconnected' &&
                dataChannelStatus === 'closed'
            ),
            first(),
            tap(() => restart())
          )
        )
      )
      .subscribe()
  )

  subscriptions.add(
    combineLatest([
      dataChannelClient.subjects.dataChannelStatusSubject,
      signalingClient.status$,
    ])
      .pipe(
        tap(([dataChannelStatus, signalingServerStatus]) => {
          if (
            dataChannelStatus === 'open' &&
            signalingServerStatus === 'connected'
          )
            signalingClient.disconnect()
        })
      )
      .subscribe()
  )

  subscriptions.add(
    subjects.iceConnectionStateSubject
      .pipe(
        filter((state) => state === 'disconnected'),
        tap(() => {
          restart()
        })
      )
      .subscribe()
  )

  const destroy = () => {
    input.logger?.debug(`🕸🧹 destroying webRTC instance`)
    iceCandidateClient.destroy()
    dataChannelClient.destroy()
    peerConnectionClient.destroy()
    subscriptions.unsubscribe()
  }

  return {
    peerConnection,
    dataChannelClient,
    iceCandidateClient,
    subjects,
    destroy,
  }
}
