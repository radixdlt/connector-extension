import { Subscription } from 'rxjs'
import { sendMessage } from './observables/send-message'
import { connect } from './observables/connect'
import { disconnect } from './observables/disconnect'
import { reconnect } from './observables/reconnect'
import {
  generateConnectionSecrets,
  connectionPassword,
} from './observables/connection-secrets'
import { SignalingSubjectsType } from './subjects'

export type SignalingSubscriptionsDependencies = {
  sendMessage: (message: string) => void
  connect: (connectionId: string) => void
  disconnect: () => void
  getWs: () => WebSocket | undefined
}

export const SignalingSubscriptions = (
  subjects: SignalingSubjectsType,
  dependencies: SignalingSubscriptionsDependencies
) => {
  const subscriptions = new Subscription()

  subscriptions.add(
    sendMessage(
      subjects,
      dependencies.sendMessage,
      dependencies.getWs
    ).subscribe()
  )
  subscriptions.add(connect(subjects, dependencies.connect).subscribe())
  subscriptions.add(disconnect(subjects, dependencies.disconnect).subscribe())
  subscriptions.add(reconnect(subjects).subscribe())
  subscriptions.add(generateConnectionSecrets(subjects).subscribe())
  subscriptions.add(connectionPassword(subjects).subscribe())

  return subscriptions
}
