import { ReplaySubject } from 'rxjs'
import type { Message } from './_types'

export type MessageSubjects = ReturnType<typeof MessageSubjects>
export const MessageSubjects = () => ({
  messageSubject: new ReplaySubject<{
    message: Message
    tabId?: number
  }>(1),
})
