import { Subject } from 'rxjs'

export type StorageSubjectsType = ReturnType<typeof StorageSubjects>
export const StorageSubjects = () => ({
  addConnectionPasswordSubject: new Subject<Buffer>(),
  removeConnectionPasswordSubject: new Subject<void>(),
})
export const storageSubjects = StorageSubjects()
