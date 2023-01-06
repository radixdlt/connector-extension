import { Message } from 'connector/_types'
import { filter, map, merge, of, Subject, tap } from 'rxjs'
import { Logger } from 'tslog'

export type MessageClientType = ReturnType<typeof MessageClient>
export const MessageClient = (input: { logger?: Logger<unknown> }) => {
  const logger = input.logger

  const triggerSubject = new Subject<void>()

  const messageQueue: Message[] = []

  const addToQueue = (message: Message) => {
    logger?.debug(`💬⏸ message added to queue`, message)
    messageQueue.push(message)
    triggerSubject.next()
  }

  const messageQueue$ = merge(of(true), triggerSubject).pipe(
    map(() => messageQueue.shift()),
    filter((message): message is Message => !!message),
    tap((message) => {
      logger?.debug(`💬⏭ processing message`, message)
    })
  )

  return {
    addToQueue,
    nextMessage: () => triggerSubject.next(),
    messageQueue$,
  }
}
