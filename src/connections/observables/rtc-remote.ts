import { SubjectsType } from 'connections/subjects'
import log from 'loglevel'
import { ResultAsync } from 'neverthrow'
import { concatMap, tap, switchMap } from 'rxjs'

export const rtcRemoteIceCandidate = (
  subjects: SubjectsType,
  addIceCandidate: (
    iceCandidate: RTCIceCandidateInit
  ) => ResultAsync<void, Error>
) =>
  subjects.rtcRemoteIceCandidateSubject.pipe(
    concatMap((iceCandidate) => {
      log.debug(`🧊 adding incoming ice candidate`)
      return addIceCandidate(new RTCIceCandidate(iceCandidate))
    }),
    tap((result) => {
      // TODO: handle error
      if (result.isErr()) log.error(result.error)
    })
  )

export const rtcRemoteOfferSubject = (
  subjects: SubjectsType,
  setRemoteDescription: (
    sessionDescription: RTCSessionDescriptionInit
  ) => ResultAsync<void, Error>,
  createPeerConnectionAnswer: () => ResultAsync<
    RTCSessionDescriptionInit,
    Error
  >,
  setLocalDescription: (
    sessionDescription: RTCSessionDescriptionInit
  ) => ResultAsync<RTCSessionDescriptionInit, Error>
  // eslint-disable-next-line max-params
) =>
  subjects.rtcRemoteOfferSubject.pipe(
    switchMap((offer) =>
      setRemoteDescription(offer)
        .andThen(createPeerConnectionAnswer)
        .andThen(setLocalDescription)
    ),
    tap((result) => {
      // TODO: handle error
      if (result.isErr()) {
        return log.error(result.error)
      }
      subjects.rtcLocalAnswerSubject.next(result.value)
    })
  )

export const rtcRemoteAnswer = (
  subjects: SubjectsType,
  setRemoteDescription: (
    sessionDescription: RTCSessionDescriptionInit
  ) => ResultAsync<void, Error>
) =>
  subjects.rtcRemoteAnswerSubject.pipe(
    switchMap((answer) => setRemoteDescription(answer)),
    tap((result) => {
      // TODO: handle error
      if (result.isErr()) {
        return log.error(result.error)
      }
    })
  )
