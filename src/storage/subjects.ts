import { Subject } from 'rxjs'

export type StorageSubjectsType = ReturnType<typeof StorageSubjects>
export const StorageSubjects = () => ({
  addConnectionPasswordSubject: new Subject<Buffer>(),
})
export const storageSubjects = StorageSubjects()
