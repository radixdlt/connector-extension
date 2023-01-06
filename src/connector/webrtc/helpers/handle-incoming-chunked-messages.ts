import { Chunked, MessageChunk, MetaData } from 'connector/helpers'
import { Message } from 'connector/_types'
import { exhaustMap, filter, first, mergeMap, tap } from 'rxjs'
import { parseJSON } from 'utils'
import { WebRtcSubjectsType } from '../subjects'

const waitForMetaData = (subjects: WebRtcSubjectsType) =>
  subjects.onDataChannelMessageSubject.pipe(
    filter((message): message is MetaData => message.packageType === 'metaData')
  )

const waitForMessageChuck = (subjects: WebRtcSubjectsType, messageId: string) =>
  subjects.onDataChannelMessageSubject.pipe(
    filter(
      (message): message is MessageChunk =>
        message.packageType === 'chunk' && message.messageId === messageId
    )
  )

export const handleIncomingChunkedMessages = (subjects: WebRtcSubjectsType) =>
  waitForMetaData(subjects).pipe(
    exhaustMap((metadata) => {
      const chunked = Chunked(metadata)
      const messageChunk$ = waitForMessageChuck(subjects, metadata.messageId)
      return messageChunk$.pipe(
        tap((chunk) => chunked.addChunk(chunk)),
        filter(() => {
          const result = chunked.allChunksReceived()
          if (result.isErr()) return true
          return result.value
        }),
        first(),
        mergeMap(() =>
          chunked
            .toString()
            .andThen(parseJSON<Message>)
            .map((message) => ({ messageId: metadata.messageId, message }))
            .mapErr(() => metadata.messageId)
        )
      )
    })
  )
