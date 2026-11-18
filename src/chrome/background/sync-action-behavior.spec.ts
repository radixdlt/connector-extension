import { describe, it, expect, vi } from 'vitest'
import { errAsync, okAsync } from 'neverthrow'
import type { AppLogger } from 'utils/logger'
import { syncActionBehavior } from './sync-action-behavior'

const FakeEvent = () => {
  const listeners: (() => void)[] = []
  return {
    addListener: (listener: () => void) => listeners.push(listener),
    fire: () => listeners.forEach((listener) => listener()),
  }
}

describe('syncActionBehavior', () => {
  it('applies the saved icon behavior again when the browser starts and after an update', async () => {
    const onStartup = FakeEvent()
    const onInstalled = FakeEvent()
    const reapply = vi.fn(() => okAsync(true))
    const logger = { info: vi.fn(), warn: vi.fn() }
    syncActionBehavior({
      onStartup,
      onInstalled,
      reapply,
      logger: logger as unknown as AppLogger,
    })
    expect(reapply).not.toHaveBeenCalled()

    onStartup.fire()
    onInstalled.fire()

    expect(reapply).toHaveBeenCalledTimes(2)
    await vi.waitFor(() =>
      expect(logger.info).toHaveBeenCalledWith(
        'extension icon behavior applied',
        { reason: 'browser started', opens: 'side panel' },
      ),
    )
    expect(logger.info).toHaveBeenCalledWith(
      'extension icon behavior applied',
      { reason: 'installed or updated', opens: 'side panel' },
    )
  })

  it('logs when it cannot apply it', async () => {
    const onStartup = FakeEvent()
    const logger = { info: vi.fn(), warn: vi.fn() }
    syncActionBehavior({
      onStartup,
      onInstalled: FakeEvent(),
      reapply: () => errAsync(new Error('setting the popup: denied')),
      logger: logger as unknown as AppLogger,
    })

    onStartup.fire()

    await vi.waitFor(() =>
      expect(logger.warn).toHaveBeenCalledWith(
        'could not apply the extension icon behavior',
        { reason: 'browser started', message: 'setting the popup: denied' },
      ),
    )
  })
})
