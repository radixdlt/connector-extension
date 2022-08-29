import { WebRtcSubjectsType } from 'connections'
import { Subscription } from 'rxjs'
import { messageQueue } from './observables/message-queue'
import { MessageSubjectsType } from './subjects'

export const MessageSubscriptions = (
  messageSubjects: MessageSubjectsType,
  subjects: WebRtcSubjectsType
) => {
  const subscription = new Subscription()

  subscription.add(messageQueue(messageSubjects, subjects).subscribe())

  return subscription
}
