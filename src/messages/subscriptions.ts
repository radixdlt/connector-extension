import { Subscription } from 'rxjs'
import { MessageSubjectsType } from './subjects'

export const MessageSubscriptions = (messageSubjects: MessageSubjectsType) => {
  const subscription = new Subscription()

  return subscription
}
