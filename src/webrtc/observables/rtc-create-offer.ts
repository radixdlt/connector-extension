import { WebRtcSubjectsType } from 'webrtc/subjects'
import { Logger } from 'loglevel'
import { ResultAsync } from 'neverthrow'
import { switchMap, tap } from 'rxjs'

export const rtcCreateOffer = (
  subjects: WebRtcSubjectsType,
  createPeerConnectionOffer: () => ResultAsync<
    RTCSessionDescriptionInit,
    Error
  >,
  setLocalDescription: (
    sessionDescription: RTCSessionDescriptionInit
  ) => ResultAsync<RTCSessionDescriptionInit, Error>,
  logger: Logger
  // eslint-disable-next-line max-params
) =>
  subjects.rtcCreateOfferSubject.pipe(
    switchMap(() => createPeerConnectionOffer().andThen(setLocalDescription)),
    tap((result) => {
      // TODO: handle error
      if (result.isErr()) {
        return logger.error(result.error)
      }
      subjects.rtcLocalOfferSubject.next(result.value)
    })
  )
