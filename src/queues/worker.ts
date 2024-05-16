import { ResultAsync } from 'neverthrow'
import { Job } from './_types'
import { AppLogger, logger } from 'utils/logger'

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
      logger?.error(error)
      return error
    })
  return { run }
}
