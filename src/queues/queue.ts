import {
  catchError,
  concatMap,
  EMPTY,
  filter,
  firstValueFrom,
  merge,
  of,
  Subscription,
  switchMap,
  tap,
  withLatestFrom,
} from 'rxjs'
import type { Result } from 'neverthrow'
import { err, errAsync, ok, okAsync, ResultAsync } from 'neverthrow'
import type {
  Job,
  JobStatus,
  QueueInteraction,
  QueueInteractionError,
  QueueState,
} from './_types'
import {
  jobStatus,
  queueInteractionErrorType,
  queueInteractions,
} from './_types'
import type { Worker } from './worker'
import type { WorkerError } from './worker'
import type { Logger } from 'tslog'
import { QueueSubjects } from './queue-subjects'

export type QueueOptions<T> = {
  key: string
  worker: Worker<T>
  logger?: Logger<unknown>
  subjects?: QueueSubjects<T>
  paused?: boolean
  /**
   * Whether a pending job may run now: the oldest that may runs next, and the others wait
   * until `wake`. Every job may, by default.
   */
  isReady?: (job: Job<T>) => boolean
}

export type Queue<T = any> = ReturnType<typeof Queue<T>>

/**
 * Finished jobs kept with their data, newest first: enough to send again a request a
 * wallet lost (`resendRequest`), small enough that saving the state stays cheap.
 */
const FINISHED_KEPT_WITH_DATA = 50
/**
 * Finished jobs remembered by id only: a job added again with one of these ids is a
 * duplicate (a wallet answer received twice), even once its data is dropped.
 */
const FINISHED_IDS_KEPT = 1000

export const Queue = <T>({
  key,
  worker,
  logger,
  subjects = QueueSubjects<T>(),
  paused = false,
  isReady = () => true,
}: QueueOptions<T>) => {
  subjects.paused.next(paused)
  const subscriptions = new Subscription()

  /**
   * The queue's state, kept as it is: each step works on it, one after the other. A
   * JSON copy of it, written and read again at every step (8 to 10 times a job, with
   * the data of up to `FINISHED_KEPT_WITH_DATA` jobs), only cost time.
   */
  let state: QueueState<T> = {
    items: new Map(),
    ids: {
      [jobStatus.pending]: new Set(),
      [jobStatus.processing]: new Set(),
      [jobStatus.completed]: new Set(),
      [jobStatus.failed]: new Set(),
    },
  }

  const getState = (): ResultAsync<QueueState<T>, QueueInteractionError> =>
    okAsync(state)

  const saveState = (
    next: QueueState<T>,
  ): ResultAsync<undefined, QueueInteractionError> => {
    logger?.trace(`[${key}] saveState`, {
      pending: [...next.ids.pending],
      processing: [...next.ids.processing],
      completed: next.ids.completed.size,
      failed: next.ids.failed.size,
    })
    state = next
    return okAsync(undefined)
  }

  /** The state for the queue's users: theirs to keep, never changed by the queue. */
  const stateCopy = (): QueueState<T> => ({
    items: new Map(state.items),
    ids: {
      [jobStatus.pending]: new Set(state.ids.pending),
      [jobStatus.processing]: new Set(state.ids.processing),
      [jobStatus.completed]: new Set(state.ids.completed),
      [jobStatus.failed]: new Set(state.ids.failed),
    },
  })

  const addJobToPendingQueue = (
    job: Job<T>,
    state: QueueState<T>,
  ): ResultAsync<QueueState<T>, never> => {
    // Not the job's data: it is the message for the wallet.
    logger?.debug(`[${key}] addJob`, { job })
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
    logger?.debug(`[${key}] updateJobStatus`, {
      jobId: job.id,
      fromStatus: job.status,
      toStatus: status,
    })

    const updatedJob: Job<T> = { ...job, updatedAt: Date.now(), status }

    if (numberOfRetries) updatedJob.numberOfRetries = numberOfRetries

    state.items.set(jobId, updatedJob)
    state.ids[job.status].delete(jobId)
    state.ids[status].add(jobId)
    if (status === jobStatus.completed || status === jobStatus.failed)
      forgetOldFinishedJobs(state)

    return okAsync(state)
  }

  /**
   * Finished jobs never ran again, and kept them all made every step of a long session
   * slower: their data goes once `FINISHED_KEPT_WITH_DATA` newer ones finished, their
   * ids once `FINISHED_IDS_KEPT` did.
   */
  const forgetOldFinishedJobs = (state: QueueState<T>) => {
    const finished = [...state.ids.completed, ...state.ids.failed]
      .map((id) => ({ id, at: state.items.get(id)?.updatedAt ?? 0 }))
      .sort((a, b) => b.at - a.at)
    finished.slice(FINISHED_KEPT_WITH_DATA).forEach(({ id }) => {
      state.items.delete(id)
    })
    finished.slice(FINISHED_IDS_KEPT).forEach(({ id }) => {
      state.ids.completed.delete(id)
      state.ids.failed.delete(id)
    })
  }

  const removeJobQueueInteraction = (
    jobId: string,
    state: QueueState<T>,
  ): ResultAsync<QueueState<T>, QueueInteractionError> => {
    logger?.debug(`[${key}] removeJob`, {
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
      state: QueueState<T>,
    ): ResultAsync<QueueState<T>, QueueInteractionError> => {
      switch (interaction.interaction) {
        case queueInteractions.addJob:
          return addJobToPendingQueue(interaction.job, state)

        case queueInteractions.removeJob:
          return removeJobQueueInteraction(interaction.jobId, state)

        case queueInteractions.updateJobStatus:
          return getJobById(interaction.jobId).andThen((job) =>
            updateJobStatusQueueInteraction({ ...interaction, state, job }),
          )

        case queueInteractions.retryJob:
          return getJobById(interaction.jobId).andThen((job) =>
            updateJobStatusQueueInteraction({
              ...interaction,
              state,
              job,
              status: 'pending',
              numberOfRetries: job.numberOfRetries + 1,
            }),
          )

        case queueInteractions.cancelJob:
          return getJobById(interaction.jobId).andThen((job) => {
            if (job.status === 'pending')
              return updateJobStatusQueueInteraction({
                job: { ...job, canceled: true },
                state,
                status: 'completed',
              })

            return errAsync({
              reason: queueInteractionErrorType.FailedToCancelJobError,
            })
          })
      }
    }

  const checkIfJobExists = (id: string) =>
    getState().map(
      (state) =>
        state.items.has(id) ||
        state.ids.completed.has(id) ||
        state.ids.failed.has(id),
    )

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
              canceled: false,
            },
            jobId: id,
            interactionId: crypto.randomUUID(),
          }).mapErr((err) => err.error),
    )

  const addQueueInteractionAndWaitForStateUpdate = (
    interaction: QueueInteraction<T>,
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
      }),
    )

    const dispatchStateUpdate$ = of(true).pipe(
      tap(() => {
        subjects.queueInteraction.next(interaction)
      }),
      filter((v): v is never => false),
    )

    return ResultAsync.fromPromise(
      firstValueFrom(merge(waitForStateUpdate$, dispatchStateUpdate$)),
      (error) =>
        error as {
          error: QueueInteractionError
          interaction: QueueInteraction<T>
        },
    ).andThen((result) => result)
  }

  const getJobById = (id: string) =>
    getState()
      .map((state) => state.items.get(id))
      .andThen(
        (job): Result<Job<T>, QueueInteractionError> =>
          job
            ? ok(job)
            : err({ reason: queueInteractionErrorType.JobNotFoundError }),
      )

  subscriptions.add(
    subjects.queueInteraction
      .pipe(
        concatMap((interaction) =>
          // A throw while updating the state is that interaction's error: its caller
          // hears it, and the next interactions are still taken.
          ResultAsync.fromPromise(
            Promise.resolve().then(() =>
              getState()
                .andThen(updateState(interaction))
                .andThen(saveState)
                .map(() => interaction),
            ),
            (): QueueInteractionError => ({
              reason: queueInteractionErrorType.UnknownInteractionError,
            }),
          )
            .andThen((result) => result)
            .mapErr((error) => ({ error, interaction })),
        ),
        tap((result) => subjects.queueInteractionResult.next(result)),
      )
      .subscribe(),
  )

  const getNextPendingJob = (): ResultAsync<Job<T>, QueueInteractionError> =>
    getState()
      .andThen((state) => {
        // The oldest that may go now; the others wait, still pending, for `wake`.
        const id = [...state.ids.pending].find((pendingId) => {
          const job = state.items.get(pendingId)
          return !job || isReady(job)
        })
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

  /**
   * Runs `job`, then waits until its outcome is saved: completed, back to pending
   * for a retry, or failed. Only then is the next job looked at.
   */
  const processNextJob = (job: Job<T>) =>
    updateJobStatus(job.id, 'processing')
      .andThen(() =>
        ResultAsync.fromSafePromise(
          runJob(job).match(
            () => updateJobStatus(job.id, 'completed'),
            ({ shouldRetry }) =>
              shouldRetry
                ? retryJob(job.id)
                : updateJobStatus(job.id, 'failed'),
          ),
        ).andThen((saved) => saved),
      )
      .map(() => {
        subjects.processNextJob.next()
      })
      .mapErr(({ error }) => {
        logger?.warn(`[${key}] could not save the outcome of a job`, {
          jobId: job.id,
          reason: error.reason,
        })
        subjects.processNextJob.next()
      })

  /**
   * The worker's outcome for `job`, whatever happens in it. A throw (in the worker or a
   * callback of its result) is a failure, not retried — the message may have gone out —
   * instead of an error that stopped the queue for good with the job left processing.
   */
  const runJob = (job: Job<T>): ResultAsync<unknown, WorkerError> =>
    ResultAsync.fromPromise(
      Promise.resolve().then(() => worker.run(job)),
      (error): WorkerError => {
        logger?.error(`[${key}] a job threw: it fails`, {
          jobId: job.id,
          error: error instanceof Error ? error.name : 'unknown',
        })
        return { reason: 'workerThrew', shouldRetry: false }
      },
    ).andThen((result) => result)

  /** Whatever goes wrong in one step, the queue goes on with the next. */
  const keepGoing = (step: string) =>
    catchError((error: unknown) => {
      logger?.error(`[${key}] ${step} failed: carrying on`, {
        error: error instanceof Error ? error.name : 'unknown',
      })
      return EMPTY
    })

  const onStateChange$ = subjects.queueInteractionResult.pipe(
    filter((result) => result.isOk()),
  )

  const shouldProcessJobs$ = subjects.paused.pipe(
    filter((isPaused) => !isPaused),
  )

  subscriptions.add(
    merge(onStateChange$, subjects.paused, subjects.processNextJob)
      .pipe(
        concatMap(() =>
          of(true).pipe(
            withLatestFrom(shouldProcessJobs$),
            switchMap(() => getNextPendingJob().andThen(processNextJob)),
            keepGoing('processing a job'),
          ),
        ),
      )
      .subscribe(),
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
    /** Looks again at the pending jobs: one that was not ready may be now. */
    wake: () => {
      subjects.processNextJob.next()
    },
    getState: (): ResultAsync<QueueState<T>, QueueInteractionError> =>
      okAsync(stateCopy()),
    destroy: () => subscriptions.unsubscribe(),
    subjects,
    cancel: (jobId: string) =>
      getJobById(jobId)
        .andThen(() =>
          addQueueInteractionAndWaitForStateUpdate({
            interaction: 'cancelJob',
            jobId,
            interactionId: crypto.randomUUID(),
          }).mapErr((err) => err.error),
        )
        .map(() => undefined),
  }
}
