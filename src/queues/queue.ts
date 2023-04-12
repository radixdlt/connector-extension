import {
  concatMap,
  filter,
  firstValueFrom,
  merge,
  of,
  Subscription,
  switchMap,
  tap,
  withLatestFrom,
} from 'rxjs'
import { err, errAsync, ok, okAsync, Result, ResultAsync } from 'neverthrow'
import {
  Job,
  jobStatus,
  JobStatus,
  QueueInteraction,
  QueueInteractionError,
  queueInteractionErrorType,
  queueInteractions,
  QueueState,
  QueueStateRaw,
  StorageProvider,
} from './_types'
import { Worker } from './worker'
import { Logger } from 'tslog'
import { QueueSubjects } from './queue-subjects'
import { InMemoryStorage } from './storage/in-memory-storage'

export type QueueOptions<T> = {
  key: string
  worker: Worker<T>
  storage?: StorageProvider
  logger?: Logger<unknown>
  subjects?: QueueSubjects<T>
  paused?: boolean
}

export type Queue<T = any> = ReturnType<typeof Queue<T>>

export const Queue = <T>({
  storage = InMemoryStorage(),
  key,
  worker,
  logger,
  subjects = QueueSubjects<T>(),
  paused = false,
}: QueueOptions<T>) => {
  subjects.paused.next(paused)
  const subscriptions = new Subscription()

  const decodeStateData = (
    data: QueueStateRaw<T>
  ): Result<QueueState<T>, never> =>
    ok({
      items: new Map(Object.entries(data.items)),
      ids: {
        [jobStatus.pending]: new Set<string>(data.ids.pending),
        [jobStatus.processing]: new Set<string>(data.ids.processing),
        [jobStatus.completed]: new Set<string>(data.ids.completed),
        [jobStatus.failed]: new Set<string>(data.ids.failed),
      },
    })

  const transformState = (
    data: QueueState<T>
  ): Result<QueueStateRaw<T>, never> =>
    ok({
      items: [...data.items.entries()].reduce(
        (acc, [id, item]) => ({ ...acc, [id]: item }),
        {}
      ),
      ids: {
        [jobStatus.pending]: [...data.ids.pending.values()],
        [jobStatus.processing]: [...data.ids.processing.values()],
        [jobStatus.completed]: [...data.ids.completed.values()],
        [jobStatus.failed]: [...data.ids.failed.values()],
      },
    })

  const defaultState: QueueStateRaw<T> = {
    items: {},
    ids: {
      pending: [],
      processing: [],
      completed: [],
      failed: [],
    },
  }

  const getState = (): ResultAsync<QueueState<T>, QueueInteractionError> =>
    storage
      .getData<QueueStateRaw<T>>(key)
      .map((data) => data ?? defaultState)
      .andThen(decodeStateData)
      .mapErr(() => ({ reason: 'GetStateError' }))

  const saveState = (
    state: QueueState<T>
  ): ResultAsync<undefined, QueueInteractionError> =>
    transformState(state)
      .asyncAndThen((data) => {
        logger?.trace('saveState', data.ids)
        return storage.setData(key, data)
      })
      .mapErr(() => ({ reason: 'SaveStateError' }))

  const addJobToPendingQueue = (
    job: Job<T>,
    state: QueueState<T>
  ): ResultAsync<QueueState<T>, never> => {
    logger?.debug('addJob', { job })
    state.items.set(job.id, { ...job, updatedAt: Date.now() })
    state.ids.pending.add(job.id)
    return okAsync(state)
  }

  const updateJobStatusQueueInteraction = ({
    job,
    status,
    state,
    numberOfRetries,
  }: {
    job: Job<T>
    status: JobStatus
    state: QueueState<T>
    numberOfRetries?: number
  }): ResultAsync<QueueState<T>, QueueInteractionError> => {
    const jobId = job.id
    logger?.debug('updateJobStatus', {
      jobId: job.id,
      fromStatus: job.status,
      toStatus: status,
    })

    const updatedJob: Job<T> = { ...job, updatedAt: Date.now(), status }

    if (numberOfRetries) updatedJob.numberOfRetries = numberOfRetries

    state.items.set(jobId, updatedJob)
    state.ids[job.status].delete(jobId)
    state.ids[status].add(jobId)

    return okAsync(state)
  }

  const removeJobQueueInteraction = (
    jobId: string,
    state: QueueState<T>
  ): ResultAsync<QueueState<T>, QueueInteractionError> => {
    logger?.debug('removeJob', {
      jobId,
    })

    state.items.delete(jobId)
    state.ids.pending.delete(jobId)
    state.ids.completed.delete(jobId)
    state.ids.failed.delete(jobId)
    state.ids.processing.delete(jobId)

    return okAsync(state)
  }

  const updateState =
    (interaction: QueueInteraction<T>) =>
    (
      state: QueueState<T>
    ): ResultAsync<QueueState<T>, QueueInteractionError> => {
      switch (interaction.interaction) {
        case queueInteractions.addJob:
          return addJobToPendingQueue(interaction.job, state)

        case queueInteractions.removeJob:
          return removeJobQueueInteraction(interaction.jobId, state)

        case queueInteractions.updateJobStatus:
          return getJobById(interaction.jobId).andThen((job) =>
            updateJobStatusQueueInteraction({ ...interaction, state, job })
          )

        case queueInteractions.retryJob:
          return getJobById(interaction.jobId).andThen((job) =>
            updateJobStatusQueueInteraction({
              ...interaction,
              state,
              job,
              status: 'pending',
              numberOfRetries: job.numberOfRetries + 1,
            })
          )
      }
    }

  const checkIfJobExists = (id: string) =>
    getState().map((state) => state.items.has(id))

  const addJob = (data: T, id: string) =>
    checkIfJobExists(id).andThen((exists) =>
      exists
        ? errAsync({
            reason: queueInteractionErrorType.JobAlreadyExistsError,
          })
        : addQueueInteractionAndWaitForStateUpdate({
            interaction: 'addJob',
            job: {
              id,
              data,
              status: jobStatus.pending,
              numberOfRetries: 0,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
            jobId: id,
            interactionId: crypto.randomUUID(),
          }).mapErr((err) => err.error)
    )

  const addQueueInteractionAndWaitForStateUpdate = (
    interaction: QueueInteraction<T>
  ): ResultAsync<
    QueueInteraction<T>,
    {
      error: QueueInteractionError
      interaction: QueueInteraction<T>
    }
  > => {
    const waitForStateUpdate$ = subjects.queueInteractionResult.pipe(
      filter((result) => {
        if (result.isErr())
          return (
            result.error.interaction.interactionId === interaction.interactionId
          )
        return result.value.interactionId === interaction.interactionId
      })
    )

    const dispatchStateUpdate$ = of(true).pipe(
      tap(() => {
        subjects.queueInteraction.next(interaction)
      }),
      filter((v): v is never => false)
    )

    return ResultAsync.fromPromise(
      firstValueFrom(merge(waitForStateUpdate$, dispatchStateUpdate$)),
      (error) =>
        error as {
          error: QueueInteractionError
          interaction: QueueInteraction<T>
        }
    ).andThen((result) => result)
  }

  const getJobById = (id: string) =>
    getState()
      .map((state) => state.items.get(id))
      .andThen(
        (job): Result<Job<T>, QueueInteractionError> =>
          job
            ? ok(job)
            : err({ reason: queueInteractionErrorType.JobNotFoundError })
      )

  subscriptions.add(
    subjects.queueInteraction
      .pipe(
        concatMap((interaction) =>
          getState()
            .andThen(updateState(interaction))
            .andThen(saveState)
            .map(() => interaction)
            .mapErr((error) => ({ error, interaction }))
        ),
        tap((result) => subjects.queueInteractionResult.next(result))
      )
      .subscribe()
  )

  const getNextPendingJob = (): ResultAsync<Job<T>, QueueInteractionError> =>
    getState()
      .andThen((state) => {
        const id = state.ids.pending.values().next().value
        return id
          ? ok(id)
          : err({ reason: queueInteractionErrorType.JobNotFoundError })
      })
      .andThen(getJobById)

  const updateJobStatus = (jobId: string, status: JobStatus) => {
    const interactionId = crypto.randomUUID()
    return addQueueInteractionAndWaitForStateUpdate({
      interaction: 'updateJobStatus',
      jobId,
      status,
      interactionId,
    })
  }

  const retryJob = (jobId: string) => {
    const interactionId = crypto.randomUUID()
    return addQueueInteractionAndWaitForStateUpdate({
      interaction: 'retryJob',
      jobId,
      interactionId,
    })
  }

  const removeJob = (jobId: string) =>
    addQueueInteractionAndWaitForStateUpdate({
      jobId,
      interaction: 'removeJob',
      interactionId: crypto.randomUUID(),
    })

  const processNextJob = (job: Job<T>) =>
    updateJobStatus(job.id, 'processing')
      .andThen(() =>
        worker
          .run(job)
          .mapErr(({ shouldRetry }) =>
            shouldRetry ? retryJob(job.id) : updateJobStatus(job.id, 'failed')
          )
      )
      .andThen(() => updateJobStatus(job.id, 'completed'))
      .map(() => {
        subjects.processNextJob.next()
      })
      .mapErr(() => {
        subjects.processNextJob.next()
      })

  const onStateChange$ = subjects.queueInteractionResult.pipe(
    filter((result) => result.isOk())
  )

  const shouldProcessJobs$ = subjects.paused.pipe(
    filter((isPaused) => !isPaused)
  )

  subscriptions.add(
    merge(onStateChange$, subjects.paused, subjects.processNextJob)
      .pipe(
        concatMap(() =>
          of(true).pipe(
            withLatestFrom(shouldProcessJobs$),
            switchMap(() => getNextPendingJob().andThen(processNextJob))
          )
        )
      )
      .subscribe()
  )

  return {
    add: addJob,
    start: () => {
      subjects.paused.next(false)
    },
    stop: () => {
      subjects.paused.next(true)
    },
    remove: removeJob,
    getState,
    destroy: () => subscriptions.unsubscribe(),
    subjects,
  }
}
