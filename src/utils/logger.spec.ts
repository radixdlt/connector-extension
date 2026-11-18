import { describe, it, expect } from 'vitest'
import { errAsync } from 'neverthrow'
import { Worker } from 'queues/worker'
import type { ILogObj } from 'tslog'
import { logger } from './logger'

// What transports (the exported logs among them) receive from a sub-logger.
const capture = (settings: Parameters<typeof logger.getSubLogger>[0] = {}) => {
  const received: ILogObj[] = []
  const subLogger = logger.getSubLogger({
    name: 'test',
    type: 'hidden',
    ...settings,
  })
  subLogger.attachTransport((logObj) => {
    received.push(logObj)
  })
  return { subLogger, received: () => JSON.stringify(received) }
}

describe('app logger', () => {
  it('logs errors, also nested ones, instead of throwing', () => {
    const { subLogger, received } = capture()
    const error = Object.assign(new Error('the peer did not answer'), {
      code: 'timeout',
    })

    expect(() => subLogger.error(error)).not.toThrow()
    expect(() =>
      subLogger
        .getSubLogger({ name: 'nested' })
        .warn({ error: { reason: 'timeout', jsError: error }, password: 'x' }),
    ).not.toThrow()

    expect(received()).toContain('the peer did not answer')
    expect(received()).toContain('"code":"timeout"')
    expect(received()).not.toContain('"password":"x"')
  })

  it('keeps a queue worker failing with an error from rejecting', async () => {
    const jsError = Object.assign(new Error('connection lost'), {
      code: 'connectionLost',
    })
    const worker = Worker(
      () => errAsync({ reason: 'failedToSendMessage', jsError }),
      { logger: logger.getSubLogger({ name: 'worker', type: 'hidden' }) },
    )

    const result = await worker.run({ id: 'job-1' } as any)

    expect(result._unsafeUnwrapErr().reason).toBe('failedToSendMessage')
  })
})
