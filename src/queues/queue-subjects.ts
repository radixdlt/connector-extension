import { Result } from 'neverthrow'
import { ReplaySubject, Subject } from 'rxjs'
import { QueueInteraction, QueueInteractionError } from './_types'

export type QueueSubjects<T> = ReturnType<typeof QueueSubjects<T>>

export const QueueSubjects = <T>() => ({
  paused: new ReplaySubject<boolean>(1),
  queueInteraction: new Subject<QueueInteraction<T>>(),
  queueInteractionResult: new Subject<
    Result<
      QueueInteraction<T>,
      {
        error: QueueInteractionError
        interaction: QueueInteraction<T>
      }
    >
  >(),
  processNextJob: new Subject<void>(),
})
