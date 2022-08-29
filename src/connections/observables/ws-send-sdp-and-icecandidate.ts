import { Secrets } from 'connections/secrets'
import { WebRtcSubjectsType } from 'connections/subjects'
import { IceCandidate } from 'io-types/types'
import log from 'loglevel'
import { Result } from 'neverthrow'
import {
  merge,
  filter,
  map,
  withLatestFrom,
  switchMap,
  tap,
  from,
  mergeMap,
} from 'rxjs'
import { wsCreateMessage } from '../ws-create-message'
import { wsMessageConfirmation } from './ws-message-confirmation'

export const wsSendSdpAndIcecandidate = (subjects: WebRtcSubjectsType) => {
  const localOffer$ = subjects.rtcLocalOfferSubject.pipe(
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

  const localAnswer$ = subjects.rtcLocalAnswerSubject.pipe(
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

  const localIceCandidate$ = subjects.rtcLocalIceCandidateSubject.pipe(
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

  const connectionSecrets$ = subjects.wsConnectionSecretsSubject.pipe(
    filter((secrets): secrets is Result<Secrets, Error> => !!secrets)
  )

  return merge(localOffer$, localAnswer$, localIceCandidate$).pipe(
    withLatestFrom(subjects.wsSourceSubject, connectionSecrets$),
    switchMap(([{ payload, method }, source, secretsResult]) =>
      from(
        secretsResult.asyncAndThen((secrets) =>
          wsCreateMessage({ method, source, payload }, secrets)
        )
      ).pipe(mergeMap((result) => wsMessageConfirmation(subjects)(result)))
    ),
    tap((result) => {
      // TODO: handle error
      if (result.isErr()) log.error(result.error)
    })
  )
}
