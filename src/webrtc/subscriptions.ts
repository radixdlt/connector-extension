import { Subscription } from 'rxjs'
import { WebRtcSubjectsType } from 'webrtc/subjects'

import { rtcIncomingMessage } from './observables/rtc-incoming-message'
import { rtcIceConnectionState } from './observables/rtc-connection-state'
import { rtcConnection } from './observables/rtc-connection'
import { WebRtcType } from './webrtc'

export type WebRtcSubscriptionsType = ReturnType<typeof WebRtcSubscriptions>

export const WebRtcSubscriptions = (
  subjects: WebRtcSubjectsType,
  dependencies: WebRtcType
) => {
  const subscriptions = new Subscription()

  subscriptions.add(rtcIncomingMessage(subjects).subscribe())

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

  return subscriptions
}
