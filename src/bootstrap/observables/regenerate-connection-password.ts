import { SignalingSubjectsType } from 'signaling/subjects'
import { StorageSubjectsType } from 'storage/subjects'
import { delay, tap } from 'rxjs'

export const regenerateConnectionPassword = (
  signalingSubjects: SignalingSubjectsType,
  storageSubjects: StorageSubjectsType
) =>
  signalingSubjects.wsRegenerateConnectionPassword.pipe(
    tap(() => {
      storageSubjects.removeConnectionPasswordSubject.next()
    }),
    delay(0),
    tap(() => signalingSubjects.wsGenerateConnectionSecretsSubject.next())
  )
