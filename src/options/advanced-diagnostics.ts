import { useStoredFlag } from 'chrome/helpers/use-local-store'
import type { ResultAsync } from 'neverthrow'
import { okAsync } from 'neverthrow'
import { localStore } from 'chrome/helpers/storage'

/**
 * Whether the connection diagnostics show every detail of each wallet link, or only
 * whether it is connected and through which transport. Only what is shown: nothing
 * else (logs, checks, the copied report) depends on it.
 */
export const showAdvancedDiagnosticsKey = 'showAdvancedDiagnostics' as const

export const getShowAdvancedDiagnostics = (): ResultAsync<boolean, never> =>
  localStore
    .get(showAdvancedDiagnosticsKey)
    .map((show) => show === true)
    .orElse(() => okAsync(false))

export const setShowAdvancedDiagnostics = (
  show: boolean,
): ResultAsync<void, Error> => localStore.set(showAdvancedDiagnosticsKey, show)

/**
 * The setting, kept in sync with the other pages (popup, side panel, options).
 * `undefined` until read, the first time in this page.
 */
export const useShowAdvancedDiagnostics = () => {
  const [show, setShow] = useStoredFlag(showAdvancedDiagnosticsKey)

  const update = (next: boolean) => {
    const previous = show ?? false
    setShow(next)
    setShowAdvancedDiagnostics(next).mapErr(() => setShow(previous))
  }

  return [show, update] as const
}
