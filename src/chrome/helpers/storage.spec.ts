import { afterEach, describe, expect, it, vi } from 'vitest'
import { localStore, sessionStore } from './storage'

const change = (
  changes: Record<string, chrome.storage.StorageChange>,
  area: string,
) =>
  // @ts-expect-error vitest-chrome events can be triggered from tests
  chrome.storage.onChanged.callListeners(changes, area)

describe('storage', () => {
  afterEach(() => {
    vi.mocked(chrome.storage.local.get).mockReset()
    vi.mocked(chrome.storage.local.set).mockReset()
    // @ts-expect-error vitest-chrome events can be reset from tests
    chrome.storage.onChanged.clearListeners()
  })

  it('reads the value of one key, undefined when missing', async () => {
    vi.mocked(chrome.storage.local.get).mockImplementation(((key: string) =>
      Promise.resolve(
        key === 'sessionRouter' ? { sessionRouter: { s: 'w' } } : {},
      )) as any)

    expect((await localStore.get('sessionRouter'))._unsafeUnwrap()).toEqual({
      s: 'w',
    })
    expect((await localStore.get('connections'))._unsafeUnwrap()).toBe(
      undefined,
    )
  })

  it('writes one key', async () => {
    vi.mocked(chrome.storage.local.set).mockResolvedValue(undefined as never)

    await localStore.set('showAdvancedDiagnostics', true)

    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      showAdvancedDiagnostics: true,
    })
  })

  it('fails, instead of throwing, when the storage call throws', async () => {
    vi.mocked(chrome.storage.local.get).mockImplementation(() => {
      throw new Error('no storage here')
    })

    const result = await localStore.get('options')

    expect(result._unsafeUnwrapErr().message).toBe('no storage here')
  })

  it('reports changes of its key in its area only, until stopped', () => {
    const listener = vi.fn()
    const stop = localStore.onChange('connections', listener)

    change({ connections: { newValue: { a: 1 }, oldValue: {} } }, 'local')
    change({ connections: { newValue: { b: 2 } } }, 'session')
    change({ options: { newValue: {} } }, 'local')
    stop()
    change({ connections: { newValue: { c: 3 } } }, 'local')

    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith({ a: 1 }, {})
  })

  it('keeps the session area apart', () => {
    const listener = vi.fn()
    sessionStore.onChange('popupId', listener)

    change({ popupId: { newValue: 4 } }, 'local')
    change({ popupId: { newValue: 5 } }, 'session')

    expect(listener).toHaveBeenCalledWith(5, undefined)
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
