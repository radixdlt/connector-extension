import { WebRtcClientType } from 'connector/webrtc/webrtc-client'
import { Subscription, tap } from 'rxjs'
import { SignalingSubjectsType } from 'connector/signaling/subjects'
import { connection } from './observables/connection'
import { wsSendMessage } from './observables/ws-send-message'
import { wsIncomingMessage } from './observables/ws-incoming-message'
import { rtcRestart } from './observables/rtc-restart'
import { wsConnect } from './observables/ws-connect'
import { wsConnectionPasswordChange } from './observables/ws-connection-password-change'
import { Logger } from 'loglevel'
import { StorageClientType } from 'connector/storage/storage-client'
import { storeConnectionPassword } from './observables/store-connection-password'
import { regenerateConnectionPassword } from './observables/regenerate-connection-password'
import { ConnectorSubjectsType } from './subjects'

export type ApplicationSubscriptionsInput = {
  webRtc: WebRtcClientType
  signalingSubjects: SignalingSubjectsType
  storage: StorageClientType
  connectorSubjects: ConnectorSubjectsType
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
    wsSendMessage(
      input.signalingSubjects,
      input.webRtc.subjects,
      input.logger
    ).subscribe()
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

  subscriptions.add(
    wsConnectionPasswordChange(
      input.storage.subjects,
      input.signalingSubjects
    ).subscribe()
  )

  subscriptions.add(
    storeConnectionPassword(
      input.webRtc.subjects,
      input.signalingSubjects,
      input.storage.subjects
    ).subscribe()
  )

  subscriptions.add(
    regenerateConnectionPassword(
      input.signalingSubjects,
      input.storage.subjects,
      input.webRtc.subjects
    ).subscribe()
  )

  subscriptions.add(
    input.storage.subjects.onPasswordChange
      .pipe(
        tap(() =>
          input.storage
            .getConnectionPassword()
            .map((connectionPassword) =>
              input.connectorSubjects.pairingStateSubject.next(
                connectionPassword ? 'paired' : 'notPaired'
              )
            )
        )
      )
      .subscribe()
  )

  return subscriptions
}
