import { ResultAsync } from 'neverthrow'

export const getExtensionTabsByUrl = (
  url: string,
): ResultAsync<chrome.tabs.Tab[], Error> =>
  ResultAsync.fromPromise(
    new Promise((resolve) => {
      chrome.tabs.query({}, (tabs) => {
        resolve(
          tabs.filter(
            (tab) => tab.url?.includes(`${chrome.runtime.id}/${url}`),
          ),
        )
      })
    }),
    (error) => error as Error,
  )
