import { describe, expect, it, vi } from 'vitest'
import { SessionRuns } from './session-runs'

const runs = () =>
  SessionRuns({
    retryDelay: { initial: 100, max: 1_000 },
    onRunFailed: vi.fn(),
  })

describe('the runs of a session', () => {
  it('starts each run once the one before it has finished', async () => {
    const sessions = runs()
    const order: string[] = []
    let finishFirst = () => {}

    sessions.chain(async () => {
      order.push('first started')
      await new Promise<void>((resolve) => {
        finishFirst = resolve
      })
      order.push('first finished')
    })
    const second = sessions.chain(async () => {
      order.push('second started')
    })
    await new Promise((resolve) => {
      setTimeout(resolve, 10)
    })
    expect(order).toEqual(['first started'])

    finishFirst()
    await second
    expect(order).toEqual(['first started', 'first finished', 'second started'])
  })

  it('ends the waits of older generations at once', async () => {
    const sessions = runs()
    const older = sessions.next()
    let waited = false
    const waiting = sessions.wait(60_000).then(() => {
      waited = true
    })

    const newer = sessions.next()
    await waiting

    expect(waited).toBe(true)
    expect(sessions.isLatest(older)).toBe(false)
    expect(sessions.isLatest(newer)).toBe(true)
  })

  it('goes on after a run that throws', async () => {
    const onRunFailed = vi.fn()
    const sessions = SessionRuns({
      retryDelay: { initial: 100, max: 1_000 },
      onRunFailed,
    })
    const ran = vi.fn()

    sessions.chain(() => Promise.reject(new Error('broken')))
    await sessions.chain(async () => ran())

    expect(onRunFailed).toHaveBeenCalledTimes(1)
    expect(ran).toHaveBeenCalledTimes(1)
  })

  it('waits longer after each failure, up to its limit', () => {
    const sessions = runs()

    expect([1, 2, 3, 4, 5].map(sessions.backoff)).toEqual([
      100, 200, 400, 800, 1_000,
    ])
  })
})
