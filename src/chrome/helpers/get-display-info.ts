import { ResultAsync } from 'neverthrow'
import { hasSystemDisplay } from 'utils/browser-detect'

export const getDisplayInfo = () => {
  if (!hasSystemDisplay()) {
    return ResultAsync.fromSafePromise(Promise.resolve(undefined))
  }
  return ResultAsync.fromPromise(
    chrome.system.display.getInfo({
      singleUnified: true,
    }),
    (error) => error as Error,
  ).map(([display]) => display)
}
