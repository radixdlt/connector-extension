import { SubjectsType } from 'connections/subjects'
import log from 'loglevel'
import { ResultAsync } from 'neverthrow'
import { switchMap, tap } from 'rxjs'

export const rtcCreateOffer = (
  subjects: SubjectsType,
  createPeerConnectionOffer: () => ResultAsync<
    RTCSessionDescriptionInit,
    Error
  >,
  setLocalDescription: (
    sessionDescription: RTCSessionDescriptionInit
  ) => ResultAsync<RTCSessionDescriptionInit, Error>
) =>
  subjects.rtcCreateOfferSubject.pipe(
    switchMap(() => createPeerConnectionOffer().andThen(setLocalDescription)),
    tap((result) => {
      // TODO: handle error
      if (result.isErr()) {
        return log.error(result.error)
      }
      subjects.rtcLocalOfferSubject.next(result.value)
    })
  )
