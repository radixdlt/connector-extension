import { MessageConfirmation } from 'connector/helpers'
import { filter } from 'rxjs'
import { WebRtcSubjectsType } from '../subjects'

export const waitForConfirmation = (
  subjects: WebRtcSubjectsType,
  messageId: string
) =>
  subjects.onDataChannelMessageSubject.pipe(
    filter(
      (message): message is MessageConfirmation =>
        message.packageType === 'receiveMessageConfirmation' &&
        message.messageId === messageId
    )
  )
