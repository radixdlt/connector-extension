import { transformBufferToSealbox } from 'crypto/sealbox'
import { decrypt } from 'crypto/encryption'
import { DataTypes } from 'io-types/types'
import { err, errAsync, ok, okAsync, Result, ResultAsync } from 'neverthrow'
import {
  BehaviorSubject,
  filter,
  ReplaySubject,
  Subject,
  first,
  timer,
  merge,
  map,
  switchMap,
  share,
  Subscription,
  withLatestFrom,
  pluck,
  concatMap,
  tap,
} from 'rxjs'
import { parseJSON } from 'utils/parse-json'
import { deriveSecretsFromConnectionPassword } from './signaling-server-client/secrets'
import log from 'loglevel'
import { secureRandom } from 'crypto/secure-random'

export type Status = 'connecting' | 'connected' | 'disconnected'

export const wsOfferReceived = new BehaviorSubject<boolean>(false)
export const wsSendAnswer = new ReplaySubject<RTCSessionDescriptionInit>()
export const wsOutgoingMessageSubject = new Subject<string>()
export const wsIncomingRawMessageSubject = new Subject<MessageEvent<string>>()
export const wsErrorSubject = new Subject<Event>()
export const wsStatusSubject = new BehaviorSubject<Status>('disconnected')
export const wsConnect = new Subject<void>()
export const wsDisconnect = new Subject<void>()
export const wsConnectionPasswordSubject = new BehaviorSubject<
  Buffer | undefined
>(undefined)
export const wsGenerateConnectionSecretsSubject = new Subject<void>()
export const wsIncomingMessageConfirmationSubject = new Subject<DataTypes>()

export const rtcStatusSubject = new BehaviorSubject<'open' | 'closed'>('closed')
export const rtcIncomingMessageSubject = new Subject<string>()
export const rtcOutgoingMessageSubject = new Subject<string>()
export const rtcIceCandidateSubject = new Subject<RTCPeerConnectionIceEvent>()
export const rtcRemoteOfferSubject = new Subject<RTCSessionDescriptionInit>()
export const rtcRemoteAnswerSubject = new Subject<RTCSessionDescriptionInit>()
export const rtcRemoveIceCandidateSubject = new Subject<RTCIceCandidate>()

export const wsConnectionSecrets$ = wsConnectionPasswordSubject.pipe(
  switchMap((password) =>
    password
      ? deriveSecretsFromConnectionPassword(password)
      : errAsync(Error('missing connection password'))
  ),
  share()
)

// TODO: add error message type
type ServerResponse = DataTypes | { valid: DataTypes } | { error: any }

export const handleIncomingMessage = (
  result: Result<ServerResponse, Error>
): Result<DataTypes | undefined, Error> =>
  result.andThen((message) => {
    const confirmation = (message as { valid: DataTypes })?.valid
    const serverError = (message as { error: any })?.error

    if (confirmation) {
      wsIncomingMessageConfirmationSubject.next(confirmation)
      return ok(undefined)
    } else if (serverError) {
      // TODO: handle server error
      return err(Error('server error'))
    } else {
      return ok(message as DataTypes)
    }
  })

export const messageConfirmation = (requestId: string, timeout: number) =>
  merge(
    wsIncomingMessageConfirmationSubject.pipe(
      filter((message) => message.requestId === requestId),
      map(() => ok(true))
    ),
    timer(timeout).pipe(map(() => err({ requestId, reason: 'timeout' }))),
    wsErrorSubject.pipe(map(() => err({ requestId, reason: 'error' })))
  ).pipe(first())

const decryptMessagePayload = (
  message: DataTypes,
  encryptionKey: Buffer
): ResultAsync<DataTypes, Error> => {
  log.debug(`🧩 attempting to decrypt message payload`)
  return transformBufferToSealbox(Buffer.from(message.encryptedPayload, 'hex'))
    .asyncAndThen(({ ciphertextAndAuthTag, iv }) =>
      decrypt(ciphertextAndAuthTag, encryptionKey, iv).mapErr((error) => {
        log.debug(`❌ failed to decrypt payload`)
        return error
      })
    )
    .andThen((decrypted) =>
      parseJSON<DataTypes['payload']>(decrypted.toString('utf8')).mapErr(
        (error) => {
          log.debug(`❌ failed to parse decrypted payload: \n ${decrypted}`)
          return error
        }
      )
    )
    .map(
      (payload: DataTypes['payload']) =>
        ({ ...message, payload } as unknown as DataTypes)
    )
}

const distributeMessage = (message: DataTypes): Result<void, Error> => {
  switch (message.method) {
    case 'answer': {
      rtcRemoteAnswerSubject.next({ ...message.payload, type: 'answer' })
      log.debug(
        `🚀 received remote answer: \n ${JSON.stringify(message.payload)}`
      )
      return ok(undefined)
    }

    case 'offer':
      rtcRemoteOfferSubject.next({ ...message.payload, type: 'offer' })
      log.debug(
        `🗿 received remote offer: \n ${JSON.stringify(message.payload)}`
      )
      return ok(undefined)

    case 'iceCandidate':
      rtcRemoveIceCandidateSubject.next(new RTCIceCandidate(message.payload))
      log.debug(
        `🧊 received remote iceCandidate: \n ${JSON.stringify(message.payload)}`
      )
      return ok(undefined)

    default:
      log.error(`❌ received unsupported method: \n ${JSON.stringify(message)}`)
      return err(Error('invalid message method'))
  }
}

export const wsIncomingMessage$ = wsIncomingRawMessageSubject.pipe(
  pluck('data'),
  map(parseJSON),
  map(handleIncomingMessage),
  withLatestFrom(wsConnectionSecrets$),
  concatMap(([messageResult, secretsResult]) =>
    messageResult
      .asyncAndThen((message) =>
        message
          ? secretsResult
              .asyncAndThen((secrets) =>
                decryptMessagePayload(message, secrets.encryptionKey)
              )
              .andThen(distributeMessage)
          : okAsync(undefined)
      )
      // TODO: handle error
      .mapErr((error) => {
        log.error(error)
      })
  ),
  share()
)

const subscriptions = new Subscription()

subscriptions.add(wsIncomingMessage$.subscribe())
subscriptions.add(
  wsGenerateConnectionSecretsSubject
    .pipe(
      tap(() => {
        secureRandom(5).map((buffer) =>
          wsConnectionPasswordSubject.next(buffer)
        )
      })
    )
    .subscribe()
)
