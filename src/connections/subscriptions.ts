import { Subscription } from 'rxjs'
import { SubjectsType } from 'connections/subjects'
import { wsIncomingMessage } from './observables/ws-incoming-message'
import {
  wsConnectionPassword,
  wsGenerateConnectionSecrets,
} from './observables/ws-connection-secrets'
import { wsConnection } from './observables/ws-connection'
import { rtcOutgoingMessage } from './observables/rtc-outgoing-message'
import { rtcIncomingMessage } from './observables/rtc-incoming-message'
import { wsSendSdpAndIcecandidate } from './observables/ws-send-sdp-and-icecandidate'

export type SubscriptionsType = ReturnType<typeof Subscriptions>

export const Subscriptions = (subjects: SubjectsType) => {
  const subscriptions = new Subscription()

  subscriptions.add(wsIncomingMessage(subjects).subscribe())
  subscriptions.add(wsSendSdpAndIcecandidate(subjects).subscribe())
  subscriptions.add(wsConnection(subjects).subscribe())
  subscriptions.add(wsGenerateConnectionSecrets(subjects).subscribe())
  subscriptions.add(wsConnectionPassword(subjects).subscribe())

  subscriptions.add(rtcOutgoingMessage(subjects).subscribe())
  subscriptions.add(rtcIncomingMessage(subjects).subscribe())

  return subscriptions
}
