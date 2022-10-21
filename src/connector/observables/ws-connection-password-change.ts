import { SignalingSubjectsType } from 'connector/signaling/subjects'
import { StorageSubjectsType } from 'connector/storage/subjects'
import { tap } from 'rxjs'

export const wsConnectionPasswordChange = (
  storageSubjects: StorageSubjectsType,
  signalingSubjects: SignalingSubjectsType
) =>
  storageSubjects.onPasswordChange.pipe(
    tap((buffer) => signalingSubjects.wsConnectionPasswordSubject.next(buffer))
  )
