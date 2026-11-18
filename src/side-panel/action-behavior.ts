import { ResultAsync, errAsync, okAsync } from 'neverthrow'
import { config } from 'config'
import { localStore } from 'chrome/helpers/storage'

/**
 * Whether clicking the extension icon opens the side panel instead of the popup.
 * Kept in `chrome.storage.local`: Chrome forgets a popup set at runtime when the
 * extension reloads, so the background applies it again (see `syncActionBehavior`).
 */
export const openSidePanelOnActionClickKey =
  'openSidePanelOnActionClick' as const

const withContext = (what: string) => (error: Error) =>
  new Error(`${what}: ${error.message}`)

const describe = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

/** Runs a chrome.* call, synchronous throws included, as a `ResultAsync`. */
const call = <T>(what: string, fn: () => Promise<T>): ResultAsync<T, Error> =>
  ResultAsync.fromPromise(
    // `fn` runs right away, in the caller's task: a user gesture still holds.
    (async () => fn())(),
    (error) => new Error(`${what}: ${describe(error)}`),
  )

/** The side panel API (Chrome 114+, `open` from 116) is there. */
export const isSidePanelAvailable = () =>
  typeof chrome !== 'undefined' &&
  typeof chrome.sidePanel?.setPanelBehavior === 'function'

const sidePanelMissing = () =>
  new Error(
    'this browser has no side panel for extensions (Chrome 116 or later)',
  )

/** The popup declared in the manifest (`action.default_popup`). */
export const manifestPopupPath = () => {
  try {
    const manifest = chrome.runtime.getManifest() as chrome.runtime.ManifestV3
    return manifest.action?.default_popup || config.popup.pages.pairing
  } catch (error) {
    return config.popup.pages.pairing
  }
}

export const getOpenSidePanelOnActionClick = (): ResultAsync<boolean, never> =>
  localStore
    .get(openSidePanelOnActionClickKey)
    .map((openSidePanel) => openSidePanel === true)
    .orElse(() => okAsync(false))

/**
 * Makes the extension icon open the side panel (`true`) or the popup (`false`). The
 * order keeps the icon working if the second call fails: the panel behavior is set
 * before the popup is removed, and the popup is restored before the behavior is
 * cleared.
 */
export const applyActionBehavior = (
  openSidePanel: boolean,
): ResultAsync<void, Error> => {
  if (!isSidePanelAvailable()) return errAsync(sidePanelMissing())
  const setBehavior = () =>
    call('setting the side panel behavior', () =>
      chrome.sidePanel.setPanelBehavior({
        openPanelOnActionClick: openSidePanel,
      }),
    )
  const setPopup = () =>
    call('setting the popup', () =>
      chrome.action.setPopup({
        popup: openSidePanel ? '' : manifestPopupPath(),
      }),
    )
  return openSidePanel
    ? setBehavior().andThen(setPopup)
    : setPopup().andThen(setBehavior)
}

/** Applies the choice, then saves it (not saved if it could not be applied). */
export const setOpenSidePanelOnActionClick = (
  openSidePanel: boolean,
): ResultAsync<void, Error> =>
  applyActionBehavior(openSidePanel).andThen(() =>
    localStore
      .set(openSidePanelOnActionClickKey, openSidePanel)
      .mapErr(withContext('saving the side panel setting')),
  )

/**
 * Applies the saved choice again. Resolves with it. Without the side panel API,
 * the manifest's popup applies anyway: nothing to do.
 */
export const reapplyActionBehavior = (): ResultAsync<boolean, Error> =>
  getOpenSidePanelOnActionClick().andThen((openSidePanel) =>
    !openSidePanel && !isSidePanelAvailable()
      ? okAsync(openSidePanel)
      : applyActionBehavior(openSidePanel).map(() => openSidePanel),
  )

/** The id of the window this page belongs to (the popup's browser window). */
export const getCurrentWindowId = (): ResultAsync<number | undefined, Error> =>
  call('getting the current window', () => chrome.windows.getCurrent()).map(
    (window) => window.id,
  )

/**
 * Opens the side panel in `windowId` (else the current window). Call it straight
 * from a click handler, with nothing awaited before: Chrome requires the user
 * gesture.
 */
export const openSidePanel = (
  windowId: number | undefined,
): ResultAsync<void, Error> => {
  if (
    typeof chrome === 'undefined' ||
    typeof chrome.sidePanel?.open !== 'function'
  )
    return errAsync(sidePanelMissing())
  return call('opening the side panel', () =>
    chrome.sidePanel.open({
      windowId: windowId ?? chrome.windows.WINDOW_ID_CURRENT,
    }),
  )
}
