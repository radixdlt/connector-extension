import { config } from 'config'
import { SecretsClient } from 'connector/secrets-client'
import { SignalingClient } from 'connector/signaling/signaling-client'
import {
  distinctUntilChanged,
  filter,
  finalize,
  firstValueFrom,
  iif,
  map,
  merge,
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
import { errAsync, ResultAsync } from 'neverthrow'
import { errorIdentity } from 'utils/error-identity'
import { sendMessageOverDataChannelAndWaitForConfirmation } from './webrtc/helpers/send-message-over-data-channel-and-wait-for-confirmation'
import { ConnectorClientSubjects } from './subjects'
import { MessageErrorReasons } from './_types'

export type ConnectorClient = ReturnType<typeof ConnectorClient>

export const ConnectorClient = (input: {
  target: MessageSources
  source: MessageSources
  signalingServerBaseUrl: string
  logger?: Logger<unknown>
  isInitiator: boolean
  createWebRtcSubjects?: () => WebRtcSubjectsType
  createSignalingSubjects?: () => SignalingSubjectsType
  subjects?: ConnectorClientSubjects
}) => {
  const logger = input.logger
  logger?.debug(`🔌✨ connector client initiated`)

  const subjects = input.subjects || ConnectorClientSubjects()
  const shouldConnectSubject = subjects.shouldConnectSubject
  const connected = subjects.connected
  const triggerRestartSubject = subjects.triggerRestartSubject
  const onDataChannelMessageSubject = subjects.onDataChannelMessageSubject
  const onMessage = subjects.onMessage
  const sendMessageOverDataChannelSubject =
    subjects.sendMessageOverDataChannelSubject

  const createWebRtcSubjects =
    input.createWebRtcSubjects || (() => WebRtcSubjects())

  const createSignalingSubjects =
    input.createSignalingSubjects || (() => SignalingSubjects())

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
        onDataChannelMessageSubject,
        sendMessageOverDataChannelSubject,
        onMessage,
        signalingClient,
        source: input.source,
        restart: () => triggerRestartSubject.next(),
      })

      const destroy = () => {
        signalingClient.destroy()
        webRtcClient.destroy()
      }

      return webRtcClient.dataChannelClient.subjects.dataChannelStatusSubject.pipe(
        tap((status) => connected.next(status === 'open')),
        finalize(() => {
          connected.next(false)
          return destroy()
        })
      )
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
    sendMessage: (
      message: Record<string, any>,
      options?: Partial<{
        messageEventCallback: (event: 'messageSent') => void
        timeout: number
      }>
    ): ResultAsync<
      undefined,
      {
        reason: MessageErrorReasons
        jsError?: Error
      }
    > => {
      if (!connected.getValue()) return errAsync({ reason: 'notConnected' })

      const defaultMessageEventCallback = (event: 'messageSent') => {}

      const messageEventCallback =
        options?.messageEventCallback || defaultMessageEventCallback

      return sendMessageOverDataChannelAndWaitForConfirmation({
        message,
        sendMessageOverDataChannelSubject,
        onDataChannelMessageSubject,
        messageEventCallback,
        timeout: options?.timeout,
      })
    },
    onMessage$: onMessage.asObservable(),
    destroy: () => {
      logger?.debug('🔌🧹 destroying connector client')
      subscriptions.unsubscribe()
    },
  }
}
