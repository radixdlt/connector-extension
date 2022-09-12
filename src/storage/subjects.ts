import { Subject } from 'rxjs'
import { Buffer } from 'buffer'

export type StorageSubjectsType = ReturnType<typeof StorageSubjects>
export const StorageSubjects = () => ({
  addConnectionPasswordSubject: new Subject<Buffer>(),
  removeConnectionPasswordSubject: new Subject<void>(),
  onPasswordChange: new Subject<Buffer | undefined>(),
})
