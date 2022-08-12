import { ChromeApi } from 'chrome/chrome-api'
import log from 'loglevel'
import { StorageSubjectsType } from './subjects'
import { storageSubscriptions } from './subscriptions'

export type StorageClientType = ReturnType<typeof StorageClient>
export const StorageClient = (id: string, subjects: StorageSubjectsType) => {
  log.debug(`📦 storage client with id: '${id}' initiated`)
  const chromeAPI = ChromeApi(id)
  const subscription = storageSubscriptions(subjects, chromeAPI)

  const destroy = () => {
    subscription.unsubscribe()
  }

  const getConnectionPassword = () =>
    chromeAPI.storage.getItem<string>('connectionPassword')

  return { subjects, destroy, id, getConnectionPassword }
}
