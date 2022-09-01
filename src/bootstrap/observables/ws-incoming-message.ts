import { Secrets } from 'signaling/secrets'
import { WebRtcSubjectsType } from 'webrtc/subjects'
import { decrypt } from 'crypto/encryption'
import { transformBufferToSealbox } from 'crypto/sealbox'
import {
  DataTypes,
  InvalidMessageError,
  SignalingServerErrorResponse,
  SignalingServerResponse,
} from 'io-types/types'
import { validateIncomingMessage } from 'io-types/validate'
import log from 'loglevel'
import { err, ok, okAsync, Result, ResultAsync } from 'neverthrow'
import { filter, map, concatMap, withLatestFrom, share } from 'rxjs'
import { parseJSON } from 'utils'
import { Buffer } from 'buffer'
import { SignalingSubjectsType } from 'signaling/subjects'

const distributeMessage =
  (subjects: WebRtcSubjectsType) =>
  (message: DataTypes): Result<void, Error> => {
    switch (message.method) {
      case 'answer': {
        log.debug(`🚀 received remote answer:`)
        log.trace(message.payload)
        subjects.rtcRemoteAnswerSubject.next({
          ...message.payload,
          type: 'answer',
        })

        return ok(undefined)
      }

      case 'offer':
        log.debug(`🗿 received remote offer:`)
        log.trace(JSON.stringify(message.payload))
        subjects.rtcRemoteOfferSubject.next({
          ...message.payload,
          type: 'offer',
        })
        return ok(undefined)

      case 'iceCandidate':
        log.debug(`🥶 received remote iceCandidate`)
        log.trace(message.payload)
        subjects.rtcRemoteIceCandidateSubject.next(
          new RTCIceCandidate(message.payload)
        )
        return ok(undefined)

      case 'iceCandidates':
        log.debug(`🥶 received remote iceCandidates`)
        log.trace(message.payload)
        message.payload.forEach((item) =>
          subjects.rtcRemoteIceCandidateSubject.next(new RTCIceCandidate(item))
        )

        return ok(undefined)

      default:
        log.error(
          `❌ received unsupported method: \n ${JSON.stringify(message)}`
        )
        return err(Error('invalid message method'))
    }
  }

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
    .map((payload: DataTypes['payload']) => {
      log.debug(`✅ successfully decrypted payload`)
      log.trace(payload)
      return { ...message, payload } as unknown as DataTypes
    })
}

const handleIncomingMessage =
  (signalingSubjects: SignalingSubjectsType) =>
  (
    result: Result<SignalingServerResponse, InvalidMessageError>
  ): Result<DataTypes | undefined, SignalingServerErrorResponse> =>
    result.andThen((message) => {
      switch (message.info) {
        case 'remoteData': {
          return ok(message.data)
        }

        case 'invalidMessageError':
        case 'missingRemoteClientError':
        case 'validationError': {
          signalingSubjects.wsServerErrorResponseSubject.next(message)
          return err(message)
        }

        case 'confirmation': {
          signalingSubjects.wsIncomingMessageConfirmationSubject.next(message)
          break
        }
      }

      return ok(undefined)
    })

export const wsIncomingMessage = (
  signalingSubjects: SignalingSubjectsType,
  webRtcSubjects: WebRtcSubjectsType
) =>
  signalingSubjects.wsIncomingRawMessageSubject.pipe(
    map((messageEvent) => messageEvent.data),
    map((rawMessage) =>
      parseJSON<SignalingServerResponse>(rawMessage)
        .mapErr((error): InvalidMessageError => {
          log.error(`❌ could not parse message: \n '${rawMessage}' `)
          return {
            info: 'invalidMessageError',
            data: rawMessage,
            error: error.message,
          }
        })
        .map((message) => {
          log.debug(
            `🐍 parsed message:\ninfo: '${message.info}'\nrequestId: '${
              (message as any)?.requestId
            }`
          )
          log.trace(message)

          return message
        })
    ),
    map((result) =>
      handleIncomingMessage(signalingSubjects)(result).andThen((message) =>
        message ? validateIncomingMessage(message) : ok(undefined)
      )
    ),
    withLatestFrom(
      signalingSubjects.wsConnectionSecretsSubject.pipe(
        filter((result): result is Result<Secrets, Error> => !!result)
      )
    ),
    concatMap(([messageResult, secretsResult]) =>
      messageResult
        .asyncAndThen((message) =>
          message
            ? secretsResult
                .asyncAndThen((secrets) =>
                  decryptMessagePayload(message, secrets.encryptionKey)
                )
                .andThen(distributeMessage(webRtcSubjects))
            : okAsync(undefined)
        )
        // TODO: handle error
        .mapErr((error) => {
          log.error(error)
        })
    ),
    share()
  )
