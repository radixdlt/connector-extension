import log from 'loglevel'
import { err, ok, ResultAsync } from 'neverthrow'
import { errorIdentity } from 'utils/error-identity'

type EventListenerInput = Parameters<
  typeof chrome['storage']['onChanged']['addListener']
>[0]

type SendMessageInput = Parameters<typeof chrome['tabs']['sendMessage']>

export type ChromeApiType = ReturnType<typeof ChromeApi>

export const ChromeApi = (id: string) => {
  const checkIfChromeContext = () =>
    window.chrome.storage
      ? ok(undefined)
      : err(Error('could not detect chrome.storage in window object'))

  const setItem = (key: string, value: string) => {
    log.debug(`📦 storing item: {${key}: '${value}'}`)
    return checkIfChromeContext().asyncAndThen(() =>
      ResultAsync.fromPromise(
        chrome.storage.local.set({ [`${id}:${key}`]: value }),
        errorIdentity
      )
    )
  }

  const getItem = <T>(key: string): ResultAsync<T, Error> =>
    checkIfChromeContext().asyncAndThen(() =>
      ResultAsync.fromPromise(
        new Promise((resolve) => {
          log.debug(`📦 getting item with key: '${key}'`)
          chrome.storage.local.get(
            `${id}:${key}`,
            (data: Record<string, T>) => {
              resolve(data[`${id}:${key}`])
            }
          )
        }),
        errorIdentity
      )
    )

  const getAllItems = (): ResultAsync<Record<string, string>, Error> =>
    checkIfChromeContext().asyncAndThen(() =>
      ResultAsync.fromPromise(
        new Promise<Record<string, string>>((resolve) => {
          chrome.storage.local.get(null, (data) => {
            resolve(
              Object.entries(data)
                .filter(([key]) => key.includes(id))
                .reduce<Record<string, string>>(
                  (acc, [key, value]) => ({
                    ...acc,
                    [key.replace(`${id}:`, '')]: value,
                  }),
                  {}
                )
            )
          })
        }),
        errorIdentity
      )
    )

  const removeItem = (key: string | string[]) => {
    log.debug(`📦 removing item with key: '${key}'`)
    return checkIfChromeContext().asyncAndThen(() =>
      ResultAsync.fromPromise(
        chrome.storage.local.remove(`${id}:${key}`),
        errorIdentity
      )
    )
  }

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
        errorIdentity
      )
    )

  return { storage, sendMessage, id }
}
