import { err, ok, okAsync, Result, ResultAsync } from 'neverthrow'
import {
  map,
  share,
  withLatestFrom,
  pluck,
  concatMap,
  merge,
  filter,
  timer,
  first,
  Subscription,
  tap,
} from 'rxjs'
import { parseJSON } from 'utils/parse-json'
import log from 'loglevel'
import {
  rtcRemoteAnswerSubject,
  rtcRemoteOfferSubject,
  rtcRemoveIceCandidateSubject,
  wsIncomingMessageConfirmationSubject,
  wsIncomingRawMessageSubject,
  wsConnectionSecrets$,
  wsErrorSubject,
  wsServerErrorResponseSubject,
} from 'connections/subjects'
import {
  DataTypes,
  SignalingServerResponse,
  SignalingServerErrorResponse,
  InvalidMessageError,
} from 'io-types/types'
import { transformBufferToSealbox } from 'crypto/sealbox'
import { decrypt } from 'crypto/encryption'
import { validateIncomingMessage } from 'io-types/validate'

export const messageConfirmation = (requestId: string, timeout: number) =>
  merge(
    wsIncomingMessageConfirmationSubject.pipe(
      tap((message) =>
        log.debug(`👌 got message confirmation: \n ${message.requestId}`)
      ),
      filter((message) => message.requestId === requestId),
      map(() => ok(true))
    ),
    wsServerErrorResponseSubject.pipe(
      map((message) => err({ requestId, reason: 'serverError', message }))
    ),
    timer(timeout).pipe(map(() => err({ requestId, reason: 'timeout' }))),
    wsErrorSubject.pipe(map(() => err({ requestId, reason: 'error' })))
  ).pipe(first())

export const handleIncomingMessage = (
  result: Result<SignalingServerResponse, InvalidMessageError>
): Result<DataTypes | undefined, SignalingServerErrorResponse> =>
  result.andThen((message) => {
    switch (message.info) {
      case 'RemoteData': {
        return ok(message.data)
      }

      case 'InvalidMessageError':
      case 'MissingRemoteClientError':
      case 'RemoteClientDisconnected':
      case 'ValidationError': {
        wsServerErrorResponseSubject.next(message)
        return err(message)
      }

      case 'Confirmation': {
        wsIncomingMessageConfirmationSubject.next(message)
        break
      }
    }

    return ok(undefined)
  })

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
  map((rawMessage) =>
    parseJSON<SignalingServerResponse>(rawMessage).mapErr(
      (error): InvalidMessageError => {
        log.error(`❌ could not parse message: \n '${rawMessage}' `)
        return {
          info: 'InvalidMessageError',
          data: rawMessage,
          error: error.message,
        }
      }
    )
  ),
  map((result) =>
    handleIncomingMessage(result).andThen((message) =>
      message
        ? validateIncomingMessage(message).mapErr((error) => {
            log.error(`❌ validation error: \n '${error}' `)
            return error
          })
        : ok(undefined)
    )
  ),
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
        log.trace(error)
      })
  ),
  share()
)

const subscriptions = new Subscription()

subscriptions.add(wsIncomingMessage$.subscribe())
