import { messageToChunked } from 'connector/helpers'
import { Message } from 'connector/_types'
import { Result } from 'neverthrow'
import { stringify } from 'utils/stringify'
import { toBuffer } from 'utils/to-buffer'

export const prepareMessage = (message: Message) =>
  stringify(message)
    .map(toBuffer)
    .asyncAndThen(messageToChunked)
    .andThen((value) =>
      Result.combine([
        stringify(value.metaData),
        ...value.chunks.map(stringify),
      ]).map((chunks) => ({ chunks, messageId: value.metaData.messageId })),
    )
