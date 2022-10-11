import { Logger } from 'loglevel'
import { err, ok, ResultAsync } from 'neverthrow'
import { errorIdentity } from 'utils/error-identity'

type EventListenerInput = Parameters<
  typeof chrome['storage']['onChanged']['addListener']
>[0]

type SendMessageInput = Parameters<typeof chrome['tabs']['sendMessage']>

export type ChromeApiType = ReturnType<typeof ChromeApi>

export const ChromeApi = (id: string, logger: Logger) => {
  const checkIfChromeContext = () =>
    chrome.storage
      ? ok(undefined)
      : err(Error('could not detect chrome.storage in window object'))

  const setItem = (
    key: string,
    value: string,
    storeType: 'local' | 'session' = 'local'
  ) => {
    logger.debug(`📦⬇️ storing item:\n{${key}: '${value}'}`)
    return checkIfChromeContext().asyncAndThen(() =>
      ResultAsync.fromPromise(
        chrome.storage[storeType].set({ [`${id}:${key}`]: value }),
        errorIdentity
      )
    )
  }

  const getItem = <T>(
    key: string,
    storeType: 'local' | 'session' = 'local'
  ): ResultAsync<T, Error> =>
    checkIfChromeContext().asyncAndThen(() =>
      ResultAsync.fromPromise(
        new Promise((resolve) => {
          chrome.storage[storeType].get(
            `${id}:${key}`,
            (data: Record<string, T>) => {
              const value = data[`${id}:${key}`]
              logger.debug(`📦⬆️ getting item: {${key}: ${value}}`)
              resolve(value)
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

  const removeItem = (
    key: string | string[],
    storeType: 'local' | 'session' = 'local'
  ) => {
    logger.debug(`📦 removing item with key: '${key}'`)
    return checkIfChromeContext().asyncAndThen(() =>
      ResultAsync.fromPromise(
        chrome.storage[storeType].remove(`${id}:${key}`),
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
