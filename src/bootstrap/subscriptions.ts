import { WebRtcClient } from 'webrtc/webrtc-client'
import { MessageSubjectsType } from 'messages/subjects'
import { Subscription } from 'rxjs'
import { SignalingSubjectsType } from 'signaling/subjects'
import { StorageSubjectsType } from 'storage/subjects'
import { connection } from './observables/connection'
import { sendSdpAndIcecandidate } from './observables/send-sdp-and-icecandidate'
import { messageQueue } from './observables/message-queue'
import { incomingMessage } from './observables/incoming-message'
import { rtcRestart } from './observables/restart'

export type ApplicationSubscriptionsInput = {
  webRtc: WebRtcClient
  signalingSubjects: SignalingSubjectsType
  storageSubjects: StorageSubjectsType
  messageSubjects: MessageSubjectsType
}
export const ApplicationSubscriptions = (
  input: ApplicationSubscriptionsInput
) => {
  const subscriptions = new Subscription()

  subscriptions.add(
    connection(input.signalingSubjects, input.webRtc.subjects).subscribe()
  )

  subscriptions.add(
    sendSdpAndIcecandidate(
      input.signalingSubjects,
      input.webRtc.subjects
    ).subscribe()
  )

  subscriptions.add(
    messageQueue(input.messageSubjects, input.webRtc.subjects).subscribe()
  )

  subscriptions.add(
    incomingMessage(input.signalingSubjects, input.webRtc.subjects).subscribe()
  )

  subscriptions.add(
    rtcRestart(
      input.webRtc.subjects,
      input.signalingSubjects,
      input.webRtc.webRtc.createPeerConnection
    ).subscribe()
  )

  return subscriptions
}
