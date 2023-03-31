import { config } from 'config'
import { SecretsClient } from 'connector/secrets-client'
import { SignalingClient } from 'connector/signaling/signaling-client'
import { Message } from 'connector/_types'
import {
  BehaviorSubject,
  distinctUntilChanged,
  filter,
  finalize,
  first,
  firstValueFrom,
  iif,
  map,
  merge,
  Subject,
  Subscription,
  switchMap,
  tap,
  withLatestFrom,
} from 'rxjs'
import { WebRtcClient } from './webrtc/webrtc-client'
import { MessageSources } from 'io-types/types'
import { Logger } from 'tslog'
import { WebRtcSubjects, WebRtcSubjectsType } from './webrtc/subjects'
import { SignalingSubjects, SignalingSubjectsType } from './signaling/subjects'
import { MessageClient } from './messages/message-client'
import { waitForDataChannelStatus } from './webrtc/helpers/wait-for-data-channel-status'
import { sendMessage } from './messages/helpers/send-message'
import { ResultAsync } from 'neverthrow'
import { errorIdentity } from 'utils/error-identity'

export type ConnectorClient = ReturnType<typeof ConnectorClient>

export const ConnectorClient = (input: {
  target: MessageSources
  source: MessageSources
  signalingServerBaseUrl: string
  logger?: Logger<unknown>
  isInitiator: boolean
  createWebRtcSubjects?: () => WebRtcSubjectsType
  createSignalingSubjects?: () => SignalingSubjectsType
}) => {
  const logger = input.logger
  logger?.debug(`🔌✨ connector client initiated`)

  const shouldConnectSubject = new BehaviorSubject<boolean>(false)
  const connected = new BehaviorSubject<boolean>(false)
  const triggerRestartSubject = new Subject<void>()
  const onMessageSubject = new Subject<Message>()

  const createWebRtcSubjects =
    input.createWebRtcSubjects || (() => WebRtcSubjects())

  const createSignalingSubjects =
    input.createSignalingSubjects || (() => SignalingSubjects())

  const messageClient = MessageClient({ logger })
  const secretsClient = SecretsClient({ logger })

  const triggerRestart$ = triggerRestartSubject.pipe(
    withLatestFrom(shouldConnectSubject),
    map(([, shouldConnect]) => shouldConnect),
    tap(() => logger?.debug(`🔌🔄 restarting connector client`))
  )
  const triggerConnection$ = merge(
    shouldConnectSubject.pipe(
      distinctUntilChanged((oldValue, newValue) => oldValue === newValue)
    ),
    triggerRestart$
  )

  const subscriptions = new Subscription()

  const connection$ = secretsClient.secrets$.pipe(
    switchMap((secrets) => {
      const signalingClient = SignalingClient({
        baseUrl: input.signalingServerBaseUrl,
        target: input.target,
        source: input.source,
        logger,
        subjects: createSignalingSubjects(),
        secrets,
      })

      const webRtcClient = WebRtcClient({
        ...config.webRTC,
        logger,
        shouldCreateOffer: input.isInitiator,
        subjects: createWebRtcSubjects(),
        onMessageSubject,
        signalingClient,
        source: input.source,
        messageClient,
        restart: () => triggerRestartSubject.next(),
      })

      const sendMessages$ = waitForDataChannelStatus(webRtcClient, 'open').pipe(
        first(),
        switchMap(() => sendMessage({ messageClient, webRtcClient }))
      )

      const observables$ = merge(
        sendMessages$,
        webRtcClient.dataChannelClient.subjects.dataChannelStatusSubject.pipe(
          tap((status) => connected.next(status === 'open'))
        )
      )

      const destroy = () => {
        signalingClient.destroy()
        webRtcClient.destroy()
      }

      return observables$.pipe(finalize(() => destroy()))
    })
  )

  subscriptions.add(
    triggerConnection$
      .pipe(
        switchMap((shouldConnect) =>
          iif(() => !!shouldConnect, connection$, [])
        )
      )
      .subscribe()
  )

  return {
    connected$: connected.asObservable(),
    connected: () =>
      ResultAsync.fromPromise(
        firstValueFrom(connected.pipe(filter((value) => value))),
        errorIdentity
      ),
    setConnectionPassword: (password: Buffer) =>
      secretsClient.deriveSecretsFromPassword(password),
    connectionPassword$: secretsClient.secrets$.pipe(
      map((secrets) => secrets.encryptionKey)
    ),
    generateConnectionPassword: () => secretsClient.generateConnectionSecrets(),
    connect: () => shouldConnectSubject.next(true),
    disconnect: () => shouldConnectSubject.next(false),
    shouldConnect$: shouldConnectSubject.asObservable(),
    sendMessage: (message: Record<string, any>) =>
      messageClient.addToQueue(message),
    onMessage$: onMessageSubject.asObservable(),
    destroy: () => {
      logger?.debug('🔌🧹 destroying connector client')
      subscriptions.unsubscribe()
    },
  }
}
