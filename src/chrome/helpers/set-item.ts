import { ResultAsync } from 'neverthrow'

export const sessionStore = {
  setItem: (value: Record<string, any>) =>
    ResultAsync.fromPromise(
      chrome.storage.session.set(value),
      (error) => error as Error
    ),
  removeItem: (key: string) =>
    ResultAsync.fromPromise(
      chrome.storage.session.remove(key),
      (error) => error as Error
    ),
  getItem: (key: string | null) =>
    ResultAsync.fromPromise(
      chrome.storage.session.get(key),
      (error) => error as Error
    ),
  setSingleItem: (key: string, value: any) =>
    ResultAsync.fromPromise(
      chrome.storage.session.set({
        [key]: value,
      }),
      (error) => error as Error
    ),
  getSingleItem: (key: string) =>
    ResultAsync.fromPromise(
      chrome.storage.session.get(key).then((result) => result[key]),
      (error) => error as Error
    ),
} as const
