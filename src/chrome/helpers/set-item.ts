import { ResultAsync } from 'neverthrow'
import { getSessionStorageArea } from 'utils/browser-detect'

export const sessionStore = {
  setItem: (value: Record<string, any>) =>
    ResultAsync.fromPromise(
      getSessionStorageArea().set(value),
      (error) => error as Error,
    ),
  removeItem: (key: string) =>
    ResultAsync.fromPromise(
      getSessionStorageArea().remove(key),
      (error) => error as Error,
    ),
  getItem: (key: string | null) =>
    ResultAsync.fromPromise(
      getSessionStorageArea().get(key),
      (error) => error as Error,
    ),
  setSingleItem: (key: string, value: any) =>
    ResultAsync.fromPromise(
      getSessionStorageArea().set({
        [key]: value,
      }),
      (error) => error as Error,
    ),
  getSingleItem: (key: string) =>
    ResultAsync.fromPromise(
      getSessionStorageArea().get(key).then((result) => result[key]),
      (error) => error as Error,
    ),
} as const
