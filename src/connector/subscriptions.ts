import { Observable, Subscription } from 'rxjs'
import {
  connection,
  killSignalingServerConnection,
} from './observables/connection'
import { wsSendMessage } from './observables/ws-send-message'
import { wsIncomingMessage } from './observables/ws-incoming-message'
import { rtcRestart } from './observables/rtc-restart'
import { wsConnect } from './observables/ws-connect'
import { wsConnectionPasswordChange } from './observables/ws-connection-password-change'
import { storeConnectionPassword } from './observables/store-connection-password'
import { regenerateConnectionPassword } from './observables/regenerate-connection-password'
import { ConnectorSubscriptionsInput } from './_types'
import { pairingState } from './observables/pairing-state'

export const ConnectorSubscriptions = (input: ConnectorSubscriptionsInput) => {
  const subscriptions = new Subscription()

  const observables = [
    connection,
    wsSendMessage,
    wsIncomingMessage,
    rtcRestart,
    wsConnect,
    wsConnectionPasswordChange,
    storeConnectionPassword,
    regenerateConnectionPassword,
    pairingState,
    killSignalingServerConnection,
  ]

  observables.forEach(
    (fn: (input: ConnectorSubscriptionsInput) => Observable<any>) =>
      subscriptions.add(fn(input).subscribe())
  )

  return subscriptions
}
