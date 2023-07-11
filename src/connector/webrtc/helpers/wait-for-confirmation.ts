import { ChunkedMessageType, MessageConfirmation } from 'connector/_types'
import { filter, Subject } from 'rxjs'

export const waitForConfirmation = (
  onDataChannelMessageSubject: Subject<ChunkedMessageType>,
  messageId: string,
) =>
  onDataChannelMessageSubject.pipe(
    filter(
      (message): message is MessageConfirmation =>
        message.packageType === 'receiveMessageConfirmation' &&
        message.messageId === messageId,
    ),
  )
