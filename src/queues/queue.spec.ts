import { Queue, QueueOptions } from './queue'
import { InMemoryStorage } from './storage/in-memory-storage'
import { Logger } from 'tslog'
import { Worker } from './worker'
import { errAsync, okAsync } from 'neverthrow'
import { Job } from './_types'
import { filter, firstValueFrom, tap } from 'rxjs'

const logger = new Logger()

const CreateQueue = ({
  storage = InMemoryStorage(),
  key = 'TestQueue',
  worker = Worker((job) => okAsync(undefined)),
  paused = true,
  logger: queueLogger,
}: Partial<QueueOptions<any>>) =>
  Queue<any>({
    storage,
    key,
    worker,
    logger: queueLogger,
    paused,
  })

const createRandomJob = (data: any = 'test') => ({
  id: crypto.randomUUID(),
  data,
})
const createJobs = (count: number) =>
  new Array(count).fill(null).map(createRandomJob)

describe('Queue', () => {
  it('should add jobs', async () => {
    const queue = CreateQueue({})
    const jobs = createJobs(5)

    await Promise.all(jobs.map((job) => queue.add(job, job.id)))

    const result = await queue.getState()
    if (result.isErr()) throw result.error

    expect(
      jobs.every((item) => result.value.ids.pending.has(item.id)),
    ).toBeTruthy()
  })

  it('should remove job from queue', async () => {
    const queue = CreateQueue({})
    const job = createRandomJob()

    await queue.add(job, job.id)

    let result = await queue.getState()
    if (result.isErr()) throw result.error

    expect(result.value.ids.pending.has(job.id)).toBeTruthy()

    await queue.remove(job.id)

    result = await queue.getState()
    if (result.isErr()) throw result.error

    expect(result.value.ids.pending.has(job.id)).toBeFalsy()
  })

  it('should cancel job', async () => {
    const queue = CreateQueue({})
    const job = createRandomJob()

    await queue.add(job, job.id)

    let result = await queue.getState()
    if (result.isErr()) throw result.error

    expect(result.value.ids.pending.has(job.id)).toBeTruthy()

    await queue.cancel(job.id)

    result = await queue.getState()
    if (result.isErr()) throw result.error

    expect(result.value.ids.completed.has(job.id)).toBeTruthy()
    expect(result.value.items.get(job.id)?.canceled).toBeTruthy()
  })

  it('should not add job with same id multiple times', async () => {
    const queue = CreateQueue({})
    const job = createRandomJob()

    const result1 = await queue.add(job, job.id)
    const result2 = await queue.add(job, job.id)

    expect(result1.isOk()).toBeTruthy()
    expect(result2.isErr() && result2.error.reason).toEqual(
      'JobAlreadyExistsError',
    )
  })

  it('should run jobs when not paused', async () => {
    const queue = CreateQueue({
      paused: false,
      worker: Worker((job: Job<any>) => okAsync(undefined)),
    })

    const job = createRandomJob()
    await queue.add(job, job.id)

    await firstValueFrom(
      queue.subjects.queueInteractionResult.pipe(
        filter(
          (result) =>
            result.isOk() &&
            result.value.interaction === 'updateJobStatus' &&
            result.value.jobId === job.id &&
            result.value.status === 'completed',
        ),
      ),
    )
  })

  // retry flow:
  // job1 and job2 are added to the queue in parallel
  // job1 fails and is added to pending again
  // job2 is processed and completed
  // job1 is retried and completed
  it('should retry job', async () => {
    const job1 = createRandomJob()
    const job2 = createRandomJob()

    const queue = CreateQueue({
      paused: false,
      logger: undefined,
      worker: Worker((job: Job<any>) => {
        if (job.id === job1.id && job.numberOfRetries === 0)
          return errAsync({ shouldRetry: true, reason: '' })

        return okAsync(undefined)
      }),
    })

    await Promise.all([queue.add(job1, job1.id), queue.add(job2, job2.id)])

    const actual: any[] = []

    await firstValueFrom(
      queue.subjects.queueInteractionResult.pipe(
        tap((result) => {
          result.map((value) => {
            const { interactionId, ...rest } = value
            actual.push(rest)
          })
        }),
        filter(
          (result) =>
            result.isOk() &&
            result.value.interaction === 'updateJobStatus' &&
            result.value.jobId === job1.id &&
            result.value.status === 'completed',
        ),
      ),
    )

    expect(actual).toEqual([
      {
        interaction: 'updateJobStatus',
        jobId: job1.id,
        status: 'processing',
      },
      {
        interaction: 'retryJob',
        jobId: job1.id,
      },
      {
        interaction: 'updateJobStatus',
        jobId: job2.id,
        status: 'processing',
      },
      {
        interaction: 'updateJobStatus',
        jobId: job2.id,
        status: 'completed',
      },
      {
        interaction: 'updateJobStatus',
        jobId: job1.id,
        status: 'processing',
      },
      {
        interaction: 'updateJobStatus',
        jobId: job1.id,
        status: 'completed',
      },
    ])
  })

  it('should not process next job if queue is paused', async () => {
    const job1 = createRandomJob()
    const job2 = createRandomJob()
    const job3 = createRandomJob()

    const queue = CreateQueue({
      paused: false,
      logger,
      worker: Worker((job: Job<any>) => {
        if (job.id === job1.id) queue.stop()
        return okAsync(undefined)
      }),
    })

    await Promise.all([
      queue.add(job1, job1.id),
      queue.add(job2, job2.id),
      queue.add(job3, job3.id),
    ])

    const actual: any[] = []

    await firstValueFrom(
      queue.subjects.queueInteractionResult.pipe(
        tap((result) => {
          result.map((value) => {
            const { interactionId, ...rest } = value
            actual.push(rest)
          })
        }),
        filter(
          (result) =>
            result.isOk() &&
            result.value.interaction === 'updateJobStatus' &&
            result.value.jobId === job1.id &&
            result.value.status === 'completed',
        ),
      ),
    )

    expect(actual).toEqual([
      {
        interaction: 'updateJobStatus',
        jobId: job1.id,
        status: 'processing',
      },
      {
        interaction: 'updateJobStatus',
        jobId: job1.id,
        status: 'completed',
      },
    ])

    queue.start()

    await firstValueFrom(
      queue.subjects.queueInteractionResult.pipe(
        tap((result) => {
          result.map((value) => {
            const { interactionId, ...rest } = value
            actual.push(rest)
          })
        }),
        filter(
          (result) =>
            result.isOk() &&
            result.value.interaction === 'updateJobStatus' &&
            result.value.jobId === job3.id &&
            result.value.status === 'completed',
        ),
      ),
    )

    expect(actual).toEqual([
      {
        interaction: 'updateJobStatus',
        jobId: job1.id,
        status: 'processing',
      },
      {
        interaction: 'updateJobStatus',
        jobId: job1.id,
        status: 'completed',
      },
      {
        interaction: 'updateJobStatus',
        jobId: job2.id,
        status: 'processing',
      },
      {
        interaction: 'updateJobStatus',
        jobId: job2.id,
        status: 'completed',
      },
      {
        interaction: 'updateJobStatus',
        jobId: job3.id,
        status: 'processing',
      },
      {
        interaction: 'updateJobStatus',
        jobId: job3.id,
        status: 'completed',
      },
    ])
  })
})
