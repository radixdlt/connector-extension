import { MessageSubjects } from './subjects'
import { MessageSubscriptions } from './subscriptions'

export const MessageClient = (messageSubjects = MessageSubjects()) => {
  const messageSubscriptions = MessageSubscriptions(messageSubjects)

  const destroy = () => {
    messageSubscriptions.unsubscribe()
  }

  return {
    subjects: messageSubjects,
    destroy,
  }
}
