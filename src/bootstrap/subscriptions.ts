import { WebRtcClientType } from 'webrtc/webrtc-client'
import { Subscription } from 'rxjs'
import { SignalingSubjectsType } from 'signaling/subjects'
import { StorageSubjectsType } from 'storage/subjects'
import { connection } from './observables/connection'
import { wsSendMessage } from './observables/ws-send-message'
import { wsIncomingMessage } from './observables/ws-incoming-message'
import { rtcRestart } from './observables/rtc-restart'
import { wsConnect } from './observables/ws-connect'
import { Logger } from 'loglevel'

export type ApplicationSubscriptionsInput = {
  webRtc: WebRtcClientType
  signalingSubjects: SignalingSubjectsType
  storageSubjects: StorageSubjectsType
  logger: Logger
}
export const ApplicationSubscriptions = (
  input: ApplicationSubscriptionsInput
) => {
  const subscriptions = new Subscription()

  subscriptions.add(
    connection(input.signalingSubjects, input.webRtc.subjects).subscribe()
  )

  subscriptions.add(
    wsSendMessage(input.signalingSubjects, input.webRtc.subjects).subscribe()
  )

  subscriptions.add(
    wsIncomingMessage(
      input.signalingSubjects,
      input.webRtc.subjects,
      input.logger
    ).subscribe()
  )

  subscriptions.add(
    rtcRestart(
      input.webRtc.subjects,
      input.signalingSubjects,
      input.webRtc.createPeerConnection
    ).subscribe()
  )

  subscriptions.add(
    wsConnect(input.webRtc.subjects, input.signalingSubjects).subscribe()
  )

  return subscriptions
}
