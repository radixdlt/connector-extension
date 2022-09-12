import { SignalingSubjectsType } from 'signaling/subjects'
import { StorageSubjectsType } from 'storage/subjects'
import { tap } from 'rxjs'

export const wsConnectionPasswordChange = (
  storageSubjects: StorageSubjectsType,
  signalingSubjects: SignalingSubjectsType
) =>
  storageSubjects.onPasswordChange.pipe(
    tap((buffer) => signalingSubjects.wsConnectionPasswordSubject.next(buffer))
  )
