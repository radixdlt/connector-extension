import { Subject } from 'rxjs'

export type MessageSubjectsType = ReturnType<typeof MessageSubjects>
export const MessageSubjects = () => ({
  addMessageSubject: new Subject(),
})
