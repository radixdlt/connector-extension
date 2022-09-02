import { Subscription } from 'rxjs'
import { wsSendMessage } from './observables/ws-send-message'
import { wsConnect } from './observables/ws-connect'
import { wsDisconnect } from './observables/ws-disconnect'
import { wsReconnect } from './observables/ws-reconnect'
import {
  wsGenerateConnectionSecrets,
  wsConnectionPassword,
} from './observables/ws-connection-secrets'
import { SignalingSubjectsType } from './subjects'
import { Logger } from 'loglevel'
import { wsUpdatedConnectionSecrets } from './observables/ws-updated-connection-secrets'

export type SignalingSubscriptionsDependencies = {
  sendMessage: (message: string) => void
  connect: (connectionId: string) => void
  disconnect: () => void
  getWs: () => WebSocket | undefined
}

export const SignalingSubscriptions = (
  subjects: SignalingSubjectsType,
  dependencies: SignalingSubscriptionsDependencies,
  logger: Logger
) => {
  const subscriptions = new Subscription()

  subscriptions.add(
    wsSendMessage(
      subjects,
      dependencies.sendMessage,
      dependencies.getWs
    ).subscribe()
  )
  subscriptions.add(wsConnect(subjects, dependencies.connect).subscribe())
  subscriptions.add(wsDisconnect(subjects, dependencies.disconnect).subscribe())
  subscriptions.add(wsReconnect(subjects, logger).subscribe())
  subscriptions.add(wsGenerateConnectionSecrets(subjects).subscribe())
  subscriptions.add(wsConnectionPassword(subjects, logger).subscribe())
  subscriptions.add(
    wsUpdatedConnectionSecrets(
      subjects,
      dependencies.disconnect,
      logger
    ).subscribe()
  )

  return subscriptions
}
