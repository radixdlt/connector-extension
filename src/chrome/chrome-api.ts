import { err, ok, ResultAsync } from 'neverthrow'

type EventListenerInput = Parameters<
  typeof chrome['storage']['onChanged']['addListener']
>[0]

type SendMessageInput = Parameters<typeof chrome['tabs']['sendMessage']>

const ChromeApi = () => {
  const checkIfChromeContext = () =>
    window.chrome ? ok(undefined) : err(Error('not a chromium browser'))

  const setItem = (item: Record<string, any>) =>
    checkIfChromeContext().asyncAndThen(() =>
      ResultAsync.fromPromise(
        chrome.storage.sync.set(item),
        (error) => error as Error
      )
    )

  const getItem = <T>(key: string): ResultAsync<T, Error> =>
    checkIfChromeContext().asyncAndThen(() =>
      ResultAsync.fromPromise(
        new Promise((resolve) => {
          chrome.storage.sync.get(key, (data: Record<string, T>) => {
            resolve(data[key])
          })
        }),
        (error) => error as Error
      )
    )

  const getAllItems = (): ResultAsync<Record<string, any>, Error> =>
    checkIfChromeContext().asyncAndThen(() =>
      ResultAsync.fromPromise(
        new Promise<Record<string, any>>((resolve) => {
          chrome.storage.sync.get(null, (data) => {
            resolve(data)
          })
        }),
        (error) => error as Error
      )
    )

  const removeItem = (key: string | string[]) =>
    checkIfChromeContext().asyncAndThen(() =>
      ResultAsync.fromPromise(
        chrome.storage.sync.remove(key),
        (error) => error as Error
      )
    )

  const addListener = (listener: EventListenerInput) =>
    checkIfChromeContext().map(() =>
      chrome.storage.onChanged.addListener(listener)
    )

  const removeListener = (listener: EventListenerInput) =>
    checkIfChromeContext().map(() =>
      chrome.storage.onChanged.removeListener(listener)
    )

  const storage = {
    setItem,
    getItem,
    getAllItems,
    removeItem,
    addListener,
    removeListener,
  }

  const sendMessage = (
    tabId: SendMessageInput[0],
    message: SendMessageInput[1],
    options: SendMessageInput[2]
  ) =>
    checkIfChromeContext().asyncAndThen(() =>
      ResultAsync.fromPromise<any, Error>(
        new Promise((resolve) => {
          chrome.tabs.sendMessage(tabId, message, options, (response) =>
            resolve(response)
          )
        }),
        (error) => error as Error
      )
    )

  return { storage, sendMessage }
}

export const chromeAPI = ChromeApi()
