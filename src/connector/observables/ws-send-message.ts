import { ConnectorSubscriptionsInput, Secrets } from '../_types'
import { IceCandidate, IceCandidates, DataTypes } from 'io-types/types'
import { Logger } from 'loglevel'
import { Result, err, ok, ResultAsync } from 'neverthrow'
import {
  merge,
  filter,
  map,
  withLatestFrom,
  tap,
  from,
  mergeMap,
  Observable,
  of,
  timer,
  concatMap,
  bufferTime,
  first,
} from 'rxjs'
import { SignalingSubjectsType } from 'connector/signaling/subjects'
import { createIV, encrypt } from 'crypto/encryption'
import { Buffer } from 'buffer'
import { config } from 'config'

const wsCreateMessage = (
  { payload, method, source }: Pick<DataTypes, 'payload' | 'method' | 'source'>,
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

const wsMessageConfirmation = (
  subjects: SignalingSubjectsType,
  messageResult: Result<Omit<DataTypes, 'payload'>, Error>,
  logger: Logger,
  timeout = 3000
): Observable<
  Result<boolean, Error | { requestId: string; reason: string }>
  // eslint-disable-next-line max-params
> => {
  if (messageResult.isErr()) return of(err(messageResult.error))

  const message = messageResult.value

  subjects.wsOutgoingMessageSubject.next(JSON.stringify(message))

  const success$ = subjects.wsIncomingMessageConfirmationSubject.pipe(
    tap((message) =>
      logger.debug(`📡⬇️👌 got message confirmation:\n${message.requestId}`)
    ),
    filter(
      (incomingMessage) => message.requestId === incomingMessage.requestId
    ),
    map(() => ok(true))
  )

  const serverError$ = subjects.wsServerErrorResponseSubject.pipe(
    map((response) =>
      err({ requestId: message.requestId, reason: 'serverError', response })
    )
  )

  const timeout$ = timer(timeout).pipe(
    map(() => err({ requestId: message.requestId, reason: 'timeout' }))
  )

  const websocketError$ = subjects.wsErrorSubject.pipe(
    map(() => err({ requestId: message.requestId, reason: 'error' }))
  )

  return merge(success$, serverError$, timeout$, websocketError$).pipe(first())
}

export const wsSendMessage = (input: ConnectorSubscriptionsInput) => {
  const signalingSubjects = input.signalingServerClient.subjects
  const webRtcSubjects = input.webRtcClient.subjects
  const logger = input.logger
  const localOffer$ = webRtcSubjects.rtcLocalOfferSubject.pipe(
    filter(
      (
        offer
      ): offer is {
        type: 'offer'
        sdp: string
      } => !!offer.sdp
    ),
    map(({ sdp, type }) => ({ method: type, payload: { sdp } }))
  )

  const localAnswer$ = webRtcSubjects.rtcLocalAnswerSubject.pipe(
    filter(
      (
        answer
      ): answer is {
        type: 'answer'
        sdp: string
      } => !!answer.sdp
    ),
    map(({ sdp, type }) => ({ method: type, payload: { sdp } }))
  )

  const localIceCandidates$ = webRtcSubjects.rtcLocalIceCandidateSubject.pipe(
    filter(
      (iceCandidate) =>
        !!iceCandidate.candidate &&
        !!iceCandidate.sdpMid &&
        iceCandidate.sdpMLineIndex !== null
    ),
    bufferTime(config.signalingServer.iceCandidatesBatchTime),
    filter((iceCandidates) => iceCandidates.length > 0),
    map((iceCandidates) => ({
      method: 'iceCandidates' as IceCandidates['method'],
      payload: iceCandidates as IceCandidates['payload'],
    }))
  )

  const localIceCandidate$ = webRtcSubjects.rtcLocalIceCandidateSubject.pipe(
    filter(
      (iceCandidate) =>
        !!iceCandidate.candidate &&
        !!iceCandidate.sdpMid &&
        iceCandidate.sdpMLineIndex !== null
    ),
    map((iceCandidate) => ({
      method: 'iceCandidate' as IceCandidate['method'],
      payload: iceCandidate as IceCandidate['payload'],
    }))
  )

  const connectionSecrets$ = signalingSubjects.wsConnectionSecretsSubject.pipe(
    filter((secrets): secrets is Result<Secrets, Error> => !!secrets)
  )

  return merge(
    localOffer$,
    localAnswer$,
    // TODO: remove when mobile wallet adds support for batched iceCandidates
    config.signalingServer.useBatchedIceCandidates
      ? localIceCandidates$
      : localIceCandidate$
  ).pipe(
    withLatestFrom(signalingSubjects.wsSourceSubject, connectionSecrets$),
    concatMap(([{ payload, method }, source, secretsResult]) =>
      from(
        secretsResult.asyncAndThen((secrets) =>
          wsCreateMessage({ method, source, payload }, secrets)
        )
      ).pipe(
        mergeMap((result) =>
          wsMessageConfirmation(signalingSubjects, result, logger)
        )
      )
    ),
    tap((result) => {
      // TODO: handle error
      if (result.isErr()) logger.error(result.error)
    })
  )
}
