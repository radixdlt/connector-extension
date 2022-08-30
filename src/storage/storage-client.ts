import { ChromeApi } from 'chrome/chrome-api'
import log from 'loglevel'
import { StorageSubjectsType } from './subjects'
import { storageSubscriptions } from './subscriptions'

export type StorageClientType = ReturnType<typeof StorageClient>
export type StorageInput = { id: string; subjects: StorageSubjectsType }
export const StorageClient = (input: StorageInput) => {
  log.debug(`📦 storage client with id: '${input.id}' initiated`)
  // TODO: Support more browsers
  const chromeAPI = ChromeApi(input.id)
  const subscription = storageSubscriptions(input.subjects, chromeAPI)

  const destroy = () => {
    subscription.unsubscribe()
  }

  const getConnectionPassword = () =>
    chromeAPI.storage.getItem<string>('connectionPassword')

  return {
    subjects: input.subjects,
    destroy,
    id: input.id,
    getConnectionPassword,
  }
}
