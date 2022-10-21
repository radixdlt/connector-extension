import { Subscription } from 'rxjs'
import { WebRtcSubjectsType } from 'connector/webrtc/subjects'

import { rtcIncomingMessage } from './observables/rtc-incoming-message'
import { rtcIceConnectionState } from './observables/rtc-connection-state'
import { rtcConnection } from './observables/rtc-connection'
import { rtcMessageQueue } from './observables/rtc-message-queue'
import { Logger } from 'loglevel'

export type WebRtcSubscriptionsType = ReturnType<typeof WebRtcSubscriptions>
export type WebRtcSubscriptionDependencies = {
  closePeerConnection: () => void
  createPeerConnection: () => void
  destroy: () => void
  getPeerConnectionInstance: () =>
    | {
        peerConnection: RTCPeerConnection
        dataChannel: RTCDataChannel
        destroy: () => void
      }
    | undefined
}
export const WebRtcSubscriptions = (
  subjects: WebRtcSubjectsType,
  dependencies: WebRtcSubscriptionDependencies,
  logger: Logger
) => {
  const subscriptions = new Subscription()

  subscriptions.add(rtcIncomingMessage(subjects, logger).subscribe())

  subscriptions.add(
    rtcIceConnectionState(
      subjects,
      dependencies.closePeerConnection
    ).subscribe()
  )

  subscriptions.add(
    rtcConnection(
      subjects,
      dependencies.getPeerConnectionInstance,
      dependencies.createPeerConnection,
      dependencies.destroy
    ).subscribe()
  )

  subscriptions.add(rtcMessageQueue(subjects, logger).subscribe())

  return subscriptions
}
