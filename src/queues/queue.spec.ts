import type { QueueOptions } from './queue'
import { Queue } from './queue'
import { Logger } from 'tslog'
import { Worker } from './worker'
import { errAsync, okAsync } from 'neverthrow'
import type { Job } from './_types'
import { filter, firstValueFrom, tap } from 'rxjs'
import { describe, it, expect } from 'vitest'

const logger = new Logger()

const CreateQueue = ({
  key = 'TestQueue',
  worker = Worker(() => okAsync(undefined)),
  paused = true,
  logger: queueLogger,
  isReady,
}: Partial<QueueOptions<any>>) =>
  Queue<any>({
    key,
    worker,
    logger: queueLogger,
    paused,
    isReady,
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
      worker: Worker(() => okAsync(undefined)),
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
            // eslint-disable-next-line @typescript-eslint/no-unused-vars -- omits the key from the rest
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

  it('saves a failure before it runs the next job', async () => {
    const failing = createRandomJob('fails')
    const next = createRandomJob('next')
    let failedWhenNextRan: boolean | undefined
    const queue: ReturnType<typeof CreateQueue> = CreateQueue({
      paused: true,
      worker: Worker((job: Job<any>) =>
        job.id === failing.id
          ? errAsync({ reason: 'broken', shouldRetry: false })
          : queue.getState().map((state) => {
              failedWhenNextRan = state.ids.failed.has(failing.id)
            }),
      ),
    })
    await queue.add(failing.data, failing.id)
    await queue.add(next.data, next.id)

    const done = firstValueFrom(
      queue.subjects.queueInteractionResult.pipe(
        filter(
          (result) =>
            result.isOk() &&
            result.value.jobId === next.id &&
            result.value.interaction === 'updateJobStatus' &&
            result.value.status === 'completed',
        ),
      ),
    )
    queue.start()
    await done

    expect(failedWhenNextRan).toBe(true)
    queue.destroy()
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
            // eslint-disable-next-line @typescript-eslint/no-unused-vars -- omits the key from the rest
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
            // eslint-disable-next-line @typescript-eslint/no-unused-vars -- omits the key from the rest
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

  describe('never stops', () => {
    const settled = async (
      queue: ReturnType<typeof CreateQueue>,
      ids: string[],
    ) => {
      for (let attempt = 0; attempt < 100; attempt += 1) {
        const state = (await queue.getState())._unsafeUnwrap()
        if (
          ids.every(
            (id) => state.ids.completed.has(id) || state.ids.failed.has(id),
          )
        )
          return state
        await new Promise((resolve) => {
          setTimeout(resolve, 10)
        })
      }
      throw new Error('the queue stopped')
    }

    it('fails a job whose worker throws, and runs the next ones', async () => {
      const ran: string[] = []
      const queue = CreateQueue({
        paused: false,
        worker: Worker((job: Job<any>) => {
          if (job.data === 'throws') throw new Error('boom')
          ran.push(job.id)
          return okAsync(undefined)
        }),
      })
      const bad = createRandomJob('throws')
      const good = createJobs(2)

      await queue.add(bad.data, bad.id)
      for (const job of good) await queue.add(job.data, job.id)
      const state = await settled(queue, [bad.id, ...good.map((job) => job.id)])

      expect(state.ids.failed.has(bad.id)).toBe(true)
      expect(ran).toEqual(good.map((job) => job.id))
      expect(state.ids.processing.size).toBe(0)
    })

    it('fails a job whose result throws in a callback, and runs the next ones', async () => {
      const queue = CreateQueue({
        paused: false,
        worker: Worker((job: Job<any>) =>
          okAsync(undefined).map(() => {
            if (job.data === 'throws') throw new Error('boom in a callback')
          }),
        ),
      })
      const bad = createRandomJob('throws')
      const good = createRandomJob()

      await queue.add(bad.data, bad.id)
      await queue.add(good.data, good.id)
      const state = await settled(queue, [bad.id, good.id])

      expect(state.ids.failed.has(bad.id)).toBe(true)
      expect(state.ids.completed.has(good.id)).toBe(true)
    })
  })

  it('keeps the data of the newest finished jobs only, and still knows the others by id', async () => {
    const queue = CreateQueue({ paused: false })
    const jobs = createJobs(60)
    for (const job of jobs) await queue.add(job.data, job.id)
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const state = (await queue.getState())._unsafeUnwrap()
      if (state.ids.completed.size === 60) break
      await new Promise((resolve) => {
        setTimeout(resolve, 10)
      })
    }

    const state = (await queue.getState())._unsafeUnwrap()
    expect(state.ids.completed.size).toBe(60)
    expect(state.items.size).toBe(50)
    // The oldest lost its data, but adding it again is still a duplicate.
    expect(state.items.has(jobs[0].id)).toBe(false)
    const again = await queue.add(jobs[0].data, jobs[0].id)
    expect(again.isErr() && again.error.reason).toBe('JobAlreadyExistsError')
  })

  it('runs the oldest job that may go, and the others once woken', async () => {
    const ran: string[] = []
    let blocked = true
    const queue = CreateQueue({
      paused: false,
      worker: Worker((job) => {
        ran.push(job.data)
        return okAsync(undefined)
      }),
      isReady: (job) => !(blocked && job.data === 'held'),
    })

    await queue.add('held', 'held')
    await queue.add('free', 'free')
    await new Promise((resolve) => {
      setTimeout(resolve, 50)
    })
    expect(ran).toEqual(['free'])

    blocked = false
    queue.wake()
    await new Promise((resolve) => {
      setTimeout(resolve, 50)
    })
    expect(ran).toEqual(['free', 'held'])
  })
})
