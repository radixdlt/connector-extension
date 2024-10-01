import { ResultAsync } from 'neverthrow'

export const getTabsByOrigin = (origin: string) =>
  ResultAsync.fromPromise(
    // url pattern match requires a trailing slash
    chrome.tabs.query({ url: `${origin}/` }),
    (err) => err as Error,
  )
