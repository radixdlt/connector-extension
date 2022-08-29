import { WebRtcSubjectsType } from 'connections'
import { MessageSubjects } from './subjects'
import { MessageSubscriptions } from './subscriptions'

export const MessageClient = (
  messageSubjects = MessageSubjects(),
  webRtcSubjects: WebRtcSubjectsType
) => {
  const messageSubscriptions = MessageSubscriptions(
    messageSubjects,
    webRtcSubjects
  )

  const destroy = () => {
    messageSubscriptions.unsubscribe()
  }

  return {
    subjects: messageSubjects,
    destroy,
  }
}
