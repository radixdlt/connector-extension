import { ConnectorSubscriptionsInput, Secrets } from '../_types'
import { WebRtcSubjectsType } from 'connector/webrtc/subjects'
import { decrypt } from 'crypto/encryption'
import { transformBufferToSealbox } from 'crypto/sealbox'
import {
  DataTypes,
  InvalidMessageError,
  SignalingServerErrorResponse,
  SignalingServerResponse,
} from 'io-types/types'
import { validateIncomingMessage } from 'io-types/validate'
import { Logger } from 'loglevel'
import { err, ok, okAsync, Result, ResultAsync } from 'neverthrow'
import { filter, map, concatMap, withLatestFrom, share } from 'rxjs'
import { parseJSON } from 'utils'
import { Buffer } from 'buffer'
import { SignalingSubjectsType } from 'connector/signaling/subjects'

const distributeMessage =
  (subjects: WebRtcSubjectsType, logger: Logger) =>
  (message: DataTypes): Result<void, Error> => {
    switch (message.method) {
      case 'answer': {
        logger.debug(`📡⬇️🤛 received answer`)
        subjects.rtcRemoteAnswerSubject.next({
          ...message.payload,
          type: 'answer',
        })

        return ok(undefined)
      }

      case 'offer':
        logger.debug(`📡⬇️🤜 received offer`)
        subjects.rtcRemoteOfferSubject.next({
          ...message.payload,
          type: 'offer',
        })
        return ok(undefined)

      case 'iceCandidate':
        logger.debug(`📡⬇️🥶 received iceCandidate`)
        subjects.rtcRemoteIceCandidateSubject.next(
          new RTCIceCandidate(message.payload)
        )
        return ok(undefined)

      case 'iceCandidates':
        logger.debug(`📡⬇️🥶 received iceCandidates`)
        message.payload.forEach((item) =>
          subjects.rtcRemoteIceCandidateSubject.next(new RTCIceCandidate(item))
        )

        return ok(undefined)

      default:
        logger.error(
          `📡⬇️❌ received unsupported method\n ${JSON.stringify(message)}`
        )
        return err(Error('invalid message method'))
    }
  }

const decryptMessagePayload = (
  message: DataTypes,
  encryptionKey: Buffer,
  logger: Logger
): ResultAsync<DataTypes, Error> =>
  transformBufferToSealbox(Buffer.from(message.encryptedPayload, 'hex'))
    .asyncAndThen(({ ciphertextAndAuthTag, iv }) =>
      decrypt(ciphertextAndAuthTag, encryptionKey, iv).mapErr((error) => {
        logger.debug(`📡🧩❌ failed to decrypt payload`)
        return error
      })
    )
    .andThen((decrypted) =>
      parseJSON<DataTypes['payload']>(decrypted.toString('utf8')).mapErr(
        (error) => {
          logger.debug(
            `📡🐍❌ failed to parse decrypted payload: \n ${decrypted}`
          )
          return error
        }
      )
    )
    .map((payload: DataTypes['payload']) => {
      logger.debug(
        `📡💬✅ successfully decrypted payload\n${JSON.stringify(payload)}`
      )
      logger.trace(payload)
      return { ...message, payload } as unknown as DataTypes
    })

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

export const wsIncomingMessage = (input: ConnectorSubscriptionsInput) => {
  const signalingSubjects = input.signalingServerClient.subjects
  const webRtcSubjects = input.webRtcClient.subjects
  const logger = input.logger

  return signalingSubjects.wsIncomingRawMessageSubject.pipe(
    map((messageEvent) => messageEvent.data),
    map((rawMessage) =>
      parseJSON<SignalingServerResponse>(rawMessage).mapErr(
        (error): InvalidMessageError => {
          logger.error(`📡❌ could not parse message: \n '${rawMessage}' `)
          return {
            info: 'invalidMessageError',
            data: rawMessage,
            error: error.message,
          }
        }
      )
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
                  decryptMessagePayload(message, secrets.encryptionKey, logger)
                )
                .andThen(distributeMessage(webRtcSubjects, logger))
            : okAsync(undefined)
        )
        // TODO: handle error
        .mapErr((error) => {
          logger.error(error)
        })
    ),
    share()
  )
}
