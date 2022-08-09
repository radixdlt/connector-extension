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
  switchMap,
  Observable,
  of,
  combineLatest,
  exhaustMap,
  from,
  mergeMap,
} from 'rxjs'
import { parseJSON } from 'utils/parse-json'
import log from 'loglevel'
import { subjects as allSubjects } from 'connections/subjects'
import {
  DataTypes,
  SignalingServerResponse,
  SignalingServerErrorResponse,
  InvalidMessageError,
  IceCandidate,
} from 'io-types/types'
import { transformBufferToSealbox } from 'crypto/sealbox'
import { createIV, decrypt, encrypt } from 'crypto/encryption'
import { validateIncomingMessage } from 'io-types/validate'
import { Secrets } from './secrets'
import { Chunked, ChunkedMessageType, messageToChunked } from './data-chunking'
import { toBuffer } from 'utils/to-buffer'
import { config } from '../config'

export const MessageHandler = (subjects: typeof allSubjects) => {
  log.debug('🤝 message handler initiated')
  const sendMessageWithConfirmation = (
    messageResult: Result<Omit<DataTypes, 'payload'>, Error>,
    timeout = 3000
  ): Observable<
    Result<boolean, Error | { requestId: string; reason: string }>
  > => {
    if (messageResult.isErr()) return of(err(messageResult.error))

    const message = messageResult.value
    const { requestId } = message
    subjects.wsOutgoingMessageSubject.next(JSON.stringify(message))
    return merge(
      subjects.wsIncomingMessageConfirmationSubject.pipe(
        tap((message) =>
          log.debug(`👌 got message confirmation:\n${message.requestId}`)
        ),
        filter(
          (incomingMessage) => message.requestId === incomingMessage.requestId
        ),
        map(() => ok(true))
      ),
      subjects.wsServerErrorResponseSubject.pipe(
        map((message) => err({ requestId, reason: 'serverError', message }))
      ),
      timer(timeout).pipe(map(() => err({ requestId, reason: 'timeout' }))),
      subjects.wsErrorSubject.pipe(
        map(() => err({ requestId, reason: 'error' }))
      )
    ).pipe(first())
  }

  const handleIncomingMessage = (
    result: Result<SignalingServerResponse, InvalidMessageError>
  ): Result<DataTypes | undefined, SignalingServerErrorResponse> =>
    result.andThen((message) => {
      switch (message.info) {
        case 'remoteData': {
          return ok(message.data)
        }

        case 'invalidMessageError':
        case 'missingRemoteClientError':
        case 'remoteClientDisconnected':
        case 'validationError': {
          subjects.wsServerErrorResponseSubject.next(message)
          return err(message)
        }

        case 'confirmation': {
          subjects.wsIncomingMessageConfirmationSubject.next(message)
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
    return transformBufferToSealbox(
      Buffer.from(message.encryptedPayload, 'hex')
    )
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

  const createMessage = (
    {
      payload,
      method,
      source,
    }: Pick<DataTypes, 'payload' | 'method' | 'source'>,
    { encryptionKey, connectionId }: Secrets
  ): ResultAsync<Omit<DataTypes, 'payload'>, Error> =>
    createIV()
      .asyncAndThen((iv) =>
        encrypt(Buffer.from(JSON.stringify(payload)), encryptionKey, iv)
      )
      .map((encrypted) => ({
        requestId: crypto.randomUUID(),
        connectionId: connectionId.toString('hex'),
        encryptedPayload: encrypted.combined.toString('hex'),
        method,
        source,
      }))

  const distributeMessage = (message: DataTypes): Result<void, Error> => {
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

      default:
        log.error(
          `❌ received unsupported method: \n ${JSON.stringify(message)}`
        )
        return err(Error('invalid message method'))
    }
  }

  const wsIncomingMessage$ = subjects.wsIncomingRawMessageSubject.pipe(
    pluck('data'),
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
      handleIncomingMessage(result).andThen((message) =>
        message
          ? validateIncomingMessage(message).mapErr((error) => {
              log.error(`❌ validation error: \n '${error}' `)
              return error
            })
          : ok(undefined)
      )
    ),
    withLatestFrom(subjects.wsConnectionSecrets$),
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
  subscriptions.add(
    merge(
      subjects.rtcLocalOfferSubject.pipe(
        filter(
          (
            offer
          ): offer is {
            type: 'offer'
            sdp: string
          } => !!offer.sdp
        ),
        map(({ sdp, type }) => ({ method: type, payload: { sdp } }))
      ),
      subjects.rtcLocalAnswerSubject.pipe(
        filter(
          (
            answer
          ): answer is {
            type: 'answer'
            sdp: string
          } => !!answer.sdp
        ),
        map(({ sdp, type }) => ({ method: type, payload: { sdp } }))
      ),
      subjects.rtcLocalIceCandidateSubject.pipe(
        filter(
          (iceCandidate) =>
            !!iceCandidate.candidate &&
            !!iceCandidate.sdpMid &&
            iceCandidate.sdpMLineIndex !== null
        ),
        map(({ candidate, sdpMid, sdpMLineIndex }) => {
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          const payload = {
            candidate,
            sdpMid,
            sdpMLineIndex,
          } as IceCandidate['payload']
          return {
            method: 'iceCandidate' as IceCandidate['method'],
            payload,
          }
        })
      )
    )
      .pipe(
        withLatestFrom(
          subjects.wsSource,
          subjects.wsConnectionSecretsSubject.pipe(
            filter((secrets): secrets is Result<Secrets, Error> => !!secrets)
          )
        ),
        switchMap(([{ payload, method }, source, secretsResult]) =>
          secretsResult.asyncAndThen((secrets) =>
            createMessage({ method, source, payload }, secrets)
          )
        ),
        switchMap((result) => sendMessageWithConfirmation(result)),
        tap((result) => {
          // TODO: handle error
          if (result.isErr()) log.error(result.error)
        })
      )
      .subscribe()
  )

  subscriptions.add(
    combineLatest([subjects.rtcStatusSubject, subjects.wsConnectSubject])
      .pipe(
        tap(([webRtcStatus, shouldSignalingServerConnect]) => {
          if (webRtcStatus === 'open' && shouldSignalingServerConnect) {
            subjects.wsConnectSubject.next(false)
          }
        })
      )
      .subscribe()
  )

  const rtcParsedIncomingDataChannelMessage =
    subjects.rtcIncomingChunkedMessageSubject.pipe(
      // TODO: add runtime message validation
      map((rawMessage) => {
        const message = toBuffer(rawMessage).toString('utf-8')
        log.debug(
          `⬇️ incoming data channel message:\nsize: ${message.length} Bytes\n${message}`
        )
        return parseJSON<ChunkedMessageType>(message)
      }),
      share()
    )

  const dataChannelConfirmation = (messageIdResult: Result<string, Error>) =>
    rtcParsedIncomingDataChannelMessage.pipe(
      filter(
        (messageResult) =>
          messageIdResult.isOk() &&
          messageResult.isOk() &&
          messageResult.value.packageType === 'receiveMessageConfirmation' &&
          messageResult.value.messageId === messageIdResult.value
      ),
      tap(() =>
        log.debug(
          `👌 received webRTC outgoing datachannel message confirmation for messageId: ${messageIdResult._unsafeUnwrap()}`
        )
      )
    )

  subscriptions.add(
    subjects.rtcOutgoingMessageSubject
      .pipe(
        concatMap((rawMessage) =>
          from(
            messageToChunked(toBuffer(rawMessage)).map((message) => {
              const chunks = [
                JSON.stringify(message.metaData),
                ...message.chunks.map((chunk) => JSON.stringify(chunk)),
              ]
              chunks.forEach((chunk) =>
                subjects.rtcOutgoingChunkedMessageSubject.next(chunk)
              )
              return message.metaData.messageId
            })
          ).pipe(
            mergeMap((result) =>
              merge(
                dataChannelConfirmation(result),
                timer(config.webRTC.confirmationTimeout).pipe(
                  map(() =>
                    // eslint-disable-next-line max-nested-callbacks
                    result.map((messageId) =>
                      log.debug(
                        `❌ confirmation message timeout for messageId: '${messageId}'`
                      )
                    )
                  )
                )
              )
            ),
            first()
          )
        )
      )
      .subscribe()
  )

  subscriptions.add(
    rtcParsedIncomingDataChannelMessage
      .pipe(
        exhaustMap((messageResult) => {
          const chunkedResult = messageResult.andThen((message) =>
            message.packageType === 'metaData'
              ? ok(Chunked(message))
              : err(Error(`expected metaData got '${message.packageType}'`))
          )
          if (chunkedResult.isErr()) return [chunkedResult]
          const chunked = chunkedResult.value

          return rtcParsedIncomingDataChannelMessage.pipe(
            tap((result) =>
              result.map((message) =>
                message.packageType === 'chunk'
                  ? chunked.addChunk(message)
                  : undefined
              )
            ),
            filter(() => {
              const allChunksReceived = chunked.allChunksReceived()
              return allChunksReceived.isOk() && allChunksReceived.value
            }),
            first(),
            tap(() =>
              chunked
                .toString()
                .map((message) => {
                  subjects.rtcOutgoingConfirmationMessageSubject.next({
                    packageType: 'receiveMessageConfirmation',
                    messageId: chunked.metaData.messageId,
                  })
                  subjects.rtcIncomingMessageSubject.next(message)
                  return undefined
                })
                .mapErr((error) => {
                  log.error(error)
                  return subjects.rtcOutgoingErrorMessageSubject.next(
                    JSON.stringify({
                      packageType: 'receiveMessageError',
                      messageId: chunked.metaData.messageId,
                      error: 'messageHashesMismatch',
                    })
                  )
                })
            )
          )
        })
      )
      .subscribe()
  )

  return { subscriptions, sendMessageWithConfirmation }
}
