import { Secrets } from 'signaling/secrets'
import { WebRtcSubjectsType } from 'webrtc/subjects'
import { IceCandidates } from 'io-types/types'
import log from 'loglevel'
import { Result, err, ok } from 'neverthrow'
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
  first,
  concatMap,
  bufferTime,
} from 'rxjs'
import { DataTypes } from 'io-types/types'
import { SignalingSubjectsType } from 'signaling/subjects'
import { createIV, encrypt } from 'crypto/encryption'
import { ResultAsync } from 'neverthrow'
import { Buffer } from 'buffer'

const createMessage = (
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

const messageConfirmation =
  (subjects: SignalingSubjectsType) =>
  (
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

export const sendSdpAndIcecandidate = (
  signalingSubjects: SignalingSubjectsType,
  webRtcSubjects: WebRtcSubjectsType
) => {
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
    bufferTime(2000),
    map((iceCandidates) => ({
      method: 'iceCandidates' as IceCandidates['method'],
      payload: iceCandidates as IceCandidates['payload'],
    }))
  )

  const connectionSecrets$ = signalingSubjects.wsConnectionSecretsSubject.pipe(
    filter((secrets): secrets is Result<Secrets, Error> => !!secrets)
  )

  return merge(localOffer$, localAnswer$, localIceCandidates$).pipe(
    withLatestFrom(signalingSubjects.wsSourceSubject, connectionSecrets$),
    concatMap(([{ payload, method }, source, secretsResult]) =>
      from(
        secretsResult.asyncAndThen((secrets) =>
          createMessage({ method, source, payload }, secrets)
        )
      ).pipe(
        mergeMap((result) => messageConfirmation(signalingSubjects)(result))
      )
    ),
    tap((result) => {
      // TODO: handle error
      if (result.isErr()) log.error(result.error)
    })
  )
}
