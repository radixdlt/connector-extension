import { ok, ResultAsync } from 'neverthrow'
import { StorageProvider } from 'queues/_types'
import { parseJSON } from 'utils'

export const ChromeLocalStorage = (): StorageProvider => {
  const store = new Map<string, string>()

  const getData = (key: string): Promise<string | undefined> =>
    new Promise((resolve, reject) => {
      try {
        const data = store.get(key)
        resolve(data ?? undefined)
      } catch (error) {
        reject(error)
      }
    })

  const setData = (key: string, data: unknown): Promise<undefined> =>
    new Promise((resolve, reject) => {
      try {
        store.set(key, JSON.stringify(data))
        resolve(undefined)
      } catch (error) {
        reject(error)
      }
    })

  return {
    getData: <T = any>(key: string) =>
      ResultAsync.fromPromise(getData(key), (error) => error as Error).andThen(
        (data) => (data ? parseJSON<T>(data) : ok(undefined)),
      ),
    setData: (key: string, data: unknown) =>
      ResultAsync.fromPromise(setData(key, data), (error) => error as Error),
  }
}
