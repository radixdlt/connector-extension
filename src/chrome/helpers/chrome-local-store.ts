import { ResultAsync } from 'neverthrow'

export const chromeLocalStore = {
  setItem: (value: Record<string, any>) =>
    ResultAsync.fromPromise(
      chrome.storage.local.set(value),
      (error) => error as Error
    ),
  removeItem: (key: string) =>
    ResultAsync.fromPromise(
      chrome.storage.local.remove(key),
      (error) => error as Error
    ),
  getItem: (key: string | null) =>
    ResultAsync.fromPromise(
      chrome.storage.local.get(key),
      (error) => error as Error
    ),
} as const
