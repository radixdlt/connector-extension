import { ResultAsync } from 'neverthrow'
import { Job } from './_types'

export type Worker<T> = ReturnType<typeof Worker<T>>

export type WorkerError = {
  reason: string
  message?: string
  jsError?: Error
  shouldRetry?: boolean
}

export type WorkerRunnerOutput = ResultAsync<any, WorkerError>

export const Worker = <T>(fn: (job: Job<T>) => WorkerRunnerOutput) => {
  const run = (job: Job<T>): WorkerRunnerOutput => fn(job)
  return { run }
}
