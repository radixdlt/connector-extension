import { useEffect, useState } from 'react'
import { okAsync } from 'neverthrow'
import { localStore, type LocalStorageSchema } from './storage'

// The values last read or set in this page, by key: a screen opened again shows
// them at once instead of a default that would then change.
const lastKnown = new Map<keyof LocalStorageSchema, unknown>()

/**
 * A value of `chrome.storage.local`, kept in sync with the other pages, and how
 * to set it. `undefined` until read the first time in this page; `fallback` when
 * nothing is stored.
 */
export const useLocalStore = <K extends keyof LocalStorageSchema>(
  key: K,
  fallback: LocalStorageSchema[K],
) => {
  const [value, setValue] = useState(
    lastKnown.get(key) as LocalStorageSchema[K] | undefined,
  )

  useEffect(() => {
    let active = true
    const show = (next: LocalStorageSchema[K] | undefined) => {
      const known = next ?? fallback
      lastKnown.set(key, known)
      if (active) setValue(known)
    }
    localStore.get(key).map(show)
    const stop = localStore.onChange(key, show)
    return () => {
      active = false
      stop()
    }
    // `fallback` is a constant of the caller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const set = (next: LocalStorageSchema[K]) => {
    lastKnown.set(key, next)
    setValue(next)
    return localStore.set(key, next)
  }

  return [value, set] as const
}

/** The keys of the stored on/off settings. */
type FlagKey = {
  [K in keyof LocalStorageSchema]: LocalStorageSchema[K] extends boolean
    ? K
    : never
}[keyof LocalStorageSchema]

/**
 * An on/off setting of `chrome.storage.local`, kept in sync with the other pages:
 * on only when stored as `true`, off when it cannot be read. `undefined` until read
 * the first time in this page; not read while not `enabled`. The setter only shows a
 * value: saving it is the caller's (which may take it back if that fails).
 */
export const useStoredFlag = (key: FlagKey, enabled = true) => {
  const [value, setValue] = useState(lastKnown.get(key) as boolean | undefined)
  const show = (next: boolean) => {
    lastKnown.set(key, next)
    setValue(next)
  }

  useEffect(() => {
    if (!enabled) return
    let active = true
    localStore
      .get(key)
      .map((stored) => stored === true)
      .orElse(() => okAsync(false))
      .map((next) => {
        if (active) show(next)
      })
    const stop = localStore.onChange(key, (next) => show(next === true))
    return () => {
      active = false
      stop()
    }
    // `show` only sets state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled])

  return [value, show] as const
}
