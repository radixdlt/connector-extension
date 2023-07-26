import { ResultAsync } from 'neverthrow'

export type StorageProvider = {
  getData: <T = any>(key: string) => ResultAsync<T | undefined, Error>
  setData: (key: string, data: any) => ResultAsync<undefined, Error>
}

export const jobStatus = {
  pending: 'pending',
  processing: 'processing',
  completed: 'completed',
  failed: 'failed',
} as const

export type JobStatus = keyof typeof jobStatus

export type QueueStateRaw<T> = {
  items: Record<string, Job<T>>
  ids: Record<JobStatus, string[]>
}

export type QueueState<T> = {
  items: Map<string, Job<T>>
  ids: Record<JobStatus, Set<string>>
}

export type Job<T> = {
  id: string
  data: T
  status: JobStatus
  numberOfRetries: number
  createdAt: number
  updatedAt: number
  canceled: boolean
}

export const queueInteractions = {
  addJob: 'addJob',
  removeJob: 'removeJob',
  updateJobStatus: 'updateJobStatus',
  retryJob: 'retryJob',
  cancelJob: 'cancelJob',
} as const

export type QueueInteractions = typeof queueInteractions

export const queueInteractionErrorType = {
  UnknownInteractionError: 'UnknownInteractionError',
  SaveStateError: 'SaveStateError',
  GetStateError: 'GetStateError',
  AddJobToQueueError: 'AddJobToQueueError',
  UpdateJobStatusError: 'UpdateJobStatusError',
  JobAlreadyExistsError: 'JobAlreadyExistsError',
  JobNotFoundError: 'JobNotFoundError',
  FailedToCancelJobError: 'FailedToCancelJobError',
} as const

export type QueueInteractionError = {
  reason: keyof typeof queueInteractionErrorType
}

export type QueueInteraction<T> =
  | {
      interaction: QueueInteractions['addJob']
      job: Job<T>
      jobId: string
      interactionId: string
    }
  | {
      interaction: QueueInteractions['updateJobStatus']
      status: JobStatus
      jobId: string
      interactionId: string
    }
  | {
      interaction: QueueInteractions['retryJob']
      jobId: string
      interactionId: string
    }
  | {
      interaction: QueueInteractions['removeJob']
      jobId: string
      interactionId: string
    }
  | {
      interaction: QueueInteractions['cancelJob']
      jobId: string
      interactionId: string
    }
