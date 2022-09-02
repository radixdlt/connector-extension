import { filter, withLatestFrom, tap } from 'rxjs'
import { SignalingSubjectsType } from 'signaling/subjects'
import { StorageSubjectsType } from 'storage/subjects'
import { WebRtcSubjectsType } from 'webrtc/subjects'

export const storeConnectionPassword = (
  webRtcSubjects: WebRtcSubjectsType,
  signalingSubjects: SignalingSubjectsType,
  storageSubjects: StorageSubjectsType
) =>
  webRtcSubjects.rtcStatusSubject.pipe(
    filter((status) => status === 'connected'),
    withLatestFrom(signalingSubjects.wsConnectionSecretsSubject),
    tap(([, secretsResult]) =>
      secretsResult?.map((secrets) =>
        storageSubjects.addConnectionPasswordSubject.next(secrets.encryptionKey)
      )
    )
  )
