import { SignalingSubjectsType } from 'connector/signaling/subjects'
import { StorageSubjectsType } from 'connector/storage/subjects'
import { WebRtcSubjectsType } from 'connector/webrtc/subjects'
import { delay, tap } from 'rxjs'

export const regenerateConnectionPassword = (
  signalingSubjects: SignalingSubjectsType,
  storageSubjects: StorageSubjectsType,
  webRtcSubjects: WebRtcSubjectsType
) =>
  signalingSubjects.wsRegenerateConnectionPassword.pipe(
    tap(() => {
      storageSubjects.removeConnectionPasswordSubject.next()
      webRtcSubjects.rtcRestartSubject.next()
    }),
    delay(0),
    tap(() => signalingSubjects.wsGenerateConnectionSecretsSubject.next())
  )
