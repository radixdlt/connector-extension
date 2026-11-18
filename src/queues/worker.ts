import type { ResultAsync } from 'neverthrow'
import type { Job } from './_types'
import type { AppLogger } from 'utils/logger'

export type Worker<T> = ReturnType<typeof Worker<T>>

export type WorkerError = {
  reason: string
  message?: string
  jsError?: Error
  shouldRetry?: boolean
}

export type WorkerRunnerOutput = ResultAsync<any, WorkerError>

export const Worker = <T>(
  fn: (job: Job<T>) => WorkerRunnerOutput,
  { logger }: { logger?: AppLogger } = {},
) => {
  const run = (job: Job<T>): WorkerRunnerOutput =>
    fn(job).mapErr((error) => {
      // Technical detail: the queues' owners log what failed, at its level.
      logger?.debug('job failed', {
        jobId: job.id,
        reason: error.reason,
        shouldRetry: error.shouldRetry,
        ...(error.jsError
          ? {
              error: {
                name: error.jsError.name,
                code: (error.jsError as Error & { code?: unknown }).code,
              },
            }
          : {}),
      })
      return error
    })
  return { run }
}
