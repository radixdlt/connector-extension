import {
  Answer,
  Confirmation,
  DataTypes,
  IceCandidate,
  MessageSources,
  Offer,
  RemoteData,
} from 'io-types/types'
import { Logger } from 'tslog'
import {
  concatMap,
  delay,
  filter,
  first,
  from,
  map,
  merge,
  mergeMap,
  Observable,
  of,
  Subscription,
  switchMap,
  tap,
} from 'rxjs'
import { parseRawMessage } from '../helpers/parse-raw-message'
import { SignalingSubjectsType } from './subjects'
import {
  isRemoteClientConnectionUpdate,
  remoteClientConnected,
  remoteClientDisconnected,
  remoteClientState,
  Secrets,
} from 'connector/_types'
import { decryptMessagePayload } from 'connector/helpers'
import { err, ok, Ok, Result, ResultAsync } from 'neverthrow'
import { createIV, encrypt } from 'crypto/encryption'
import { stringify } from 'utils/stringify'
import { config } from 'config'

export type SignalingClientType = ReturnType<typeof SignalingClient>

export const SignalingClient = (input: {
  baseUrl: string
  subjects: SignalingSubjectsType
  secrets: Secrets
  target: MessageSources
  source: MessageSources
  logger?: Logger<unknown>
  restart: () => void
}) => {
  const logger = input.logger
  const subjects = input.subjects
  const subscription = new Subscription()
  const connectionId = Buffer.from(input.secrets.connectionId).toString('hex')
  const url = `${input.baseUrl}/${connectionId}?target=${input.target}&source=${input.source}`

  subjects.statusSubject.next('connecting')
  logger?.debug(`🛰⚪️ signaling server: connecting`, { url })
  const ws = new WebSocket(url)

  const onConfirmation$ = input.subjects.onMessageSubject.pipe(
    filter(
      (message): message is Confirmation => message.info === 'confirmation'
    )
  )

  const waitForConfirmation = (requestId: string) =>
    onConfirmation$.pipe(
      filter((incomingMessage) => incomingMessage.requestId === requestId)
    )

  const onMessage = (event: MessageEvent<string>) => {
    parseRawMessage(event.data).map((message) => {
      if (message.info === 'remoteData')
        logger?.trace(
          `🛰💬⬇️ received: ${message.data.method} (${message.requestId})`
        )
      else if (message.info !== 'confirmation')
        logger?.trace(`🛰💬⬇️ received:`, message)

      subjects.onMessageSubject.next(message)
    })
  }

  const onOpen = () => {
    logger?.debug(`🛰🟢 signaling server: connected`)
    subjects.statusSubject.next('connected')
  }

  const onClose = (closeEvent: CloseEvent) => {
    logger?.debug(`🛰🔴 signaling server: disconnected`)
    subjects.statusSubject.next('disconnected')
  }

  const onError = (event: Event) => {
    logger?.debug(`🛰❌ signaling server error`, event)
    subjects.onErrorSubject.next(event)
  }

  const prepareMessage = ({
    payload,
    method,
    source,
    targetClientId,
  }: Pick<
    DataTypes,
    'payload' | 'method' | 'source' | 'targetClientId'
  >): ResultAsync<Omit<DataTypes, 'payload'>, Error> =>
    createIV()
      .asyncAndThen((iv) =>
        encrypt(
          Buffer.from(JSON.stringify(payload)),
          input.secrets.encryptionKey,
          iv
        )
      )
      .map((encrypted) => ({
        requestId: crypto.randomUUID(),
        connectionId: connectionId,
        targetClientId,
        encryptedPayload: encrypted.combined.toString('hex'),
        method,
        source,
      }))
      .mapErr((err) => {
        logger?.error(`prepareMessage`, err)
        return err
      })

  const sendMessage = (
    message: Pick<DataTypes, 'payload' | 'method' | 'source' | 'targetClientId'>
  ): Observable<Result<undefined, Error>> =>
    from(prepareMessage(message)).pipe(
      mergeMap((result) => {
        if (result.isErr()) return of(err(result.error))

        const encryptedMessage = result.value

        const sendMessage$ = of(stringify(encryptedMessage)).pipe(
          tap((result) =>
            result.map((data) => {
              logger?.trace(
                `🛰💬⬆️ sending: ${message.method} (${encryptedMessage.requestId})`
              )
              return ws.send(data)
            })
          ),
          filter(() => false)
        )

        return merge(
          sendMessage$,
          waitForConfirmation(encryptedMessage.requestId)
        ).pipe(map(() => ok(undefined)))
      }),
      first()
    )

  const waitForRemoteClient = (waitFor: Set<string>) =>
    subjects.onMessageSubject.pipe(
      filter((message) => waitFor.has(message.info)),
      first()
    )

  const onOffer$ = input.subjects.onMessageSubject.pipe(
    filter(
      (message): message is RemoteData<Offer> =>
        message.info === 'remoteData' && message.data.method === 'offer'
    ),
    switchMap((message) =>
      decryptMessagePayload<Offer['payload']>(
        message.data,
        input.secrets.encryptionKey
      )
    ),
    filter((result): result is Ok<Offer['payload'], never> => !result.isErr()),
    map(
      (result): RTCSessionDescriptionInit => ({
        ...result.value,
        type: 'offer',
      })
    )
  )

  const onAnswer$ = input.subjects.onMessageSubject.pipe(
    filter(
      (message): message is RemoteData<Answer> =>
        message.info === 'remoteData' && message.data.method === 'answer'
    ),
    switchMap((message) =>
      decryptMessagePayload<Answer['payload']>(
        message.data,
        input.secrets.encryptionKey
      )
    ),
    filter((result): result is Ok<Answer['payload'], never> => !result.isErr()),
    map(
      (result): RTCSessionDescriptionInit => ({
        ...result.value,
        type: 'answer',
      })
    )
  )

  const onIceCandidate$ = input.subjects.onMessageSubject.pipe(
    filter(
      (message): message is RemoteData<IceCandidate> =>
        message.info === 'remoteData' && message.data.method === 'iceCandidate'
    ),
    concatMap((message) =>
      decryptMessagePayload<IceCandidate['payload']>(
        message.data,
        input.secrets.encryptionKey
      )
    ),
    filter(
      (result): result is Ok<IceCandidate['payload'], never> => !result.isErr()
    ),
    map((result) => new RTCIceCandidate(result.value))
  )

  const onRemoteClientConnectionStateChange$ =
    input.subjects.onMessageSubject.pipe(
      filter(isRemoteClientConnectionUpdate),
      tap((message) => {
        subjects.targetClientIdSubject.next(
          message.info === remoteClientState.remoteClientDisconnected
            ? undefined
            : message.remoteClientId
        )
      })
    )

  subscription.add(onRemoteClientConnectionStateChange$.subscribe())

  subscription.add(
    subjects.onErrorSubject
      .pipe(
        delay(1_000),
        tap(() => {
          input.restart()
        })
      )
      .subscribe()
  )

  ws.onmessage = onMessage
  ws.onopen = onOpen
  ws.onclose = onClose
  ws.onerror = onError

  return {
    remoteClientConnected$: waitForRemoteClient(remoteClientConnected),
    remoteClientDisconnected$: waitForRemoteClient(remoteClientDisconnected),
    sendMessage: (message: Pick<DataTypes, 'payload' | 'method' | 'source'>) =>
      config.signalingServer.useTargetClientId
        ? subjects.targetClientIdSubject.pipe(
            filter(Boolean),
            first(),
            switchMap((targetClientId) =>
              sendMessage({ ...message, targetClientId })
            )
          )
        : sendMessage({ ...message, targetClientId: '' }),
    status$: subjects.statusSubject.asObservable(),
    onError$: subjects.onErrorSubject.asObservable(),
    onConnect$: subjects.statusSubject.pipe(
      filter((status) => status === 'connected')
    ),
    onDisconnect$: subjects.statusSubject.pipe(
      filter((status) => status === 'disconnected')
    ),
    onOffer$,
    onAnswer$,
    onIceCandidate$,
    subjects,
    disconnect: () => {
      if (ws.readyState === 1) {
        ws.close()
      }
    },
    destroy: () => {
      subscription.unsubscribe()
      ws.close()
      ws.removeEventListener('message', onMessage)
      ws.removeEventListener('close', onClose)
      ws.removeEventListener('error', onError)
      ws.removeEventListener('open', onOpen)
      logger?.debug(`🛰🧹 destroying signaling instance`)
    },
  }
}
