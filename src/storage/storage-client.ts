import { ChromeApi } from 'chrome/chrome-api'
import log, { Logger } from 'loglevel'
import { StorageSubjectsType } from './subjects'
import { storageSubscriptions } from './subscriptions'

export const makeChromeApi = (id: string) => {
  const chromeAPI = ChromeApi(id)
  const getConnectionPassword = () =>
    chromeAPI.storage.getItem<string>('connectionPassword')
  return { chromeAPI, getConnectionPassword }
}

export type StorageClientType = ReturnType<typeof StorageClient>
export type StorageInput = {
  id: string
  subjects: StorageSubjectsType
  logger: Logger
}
export const StorageClient = (input: StorageInput) => {
  log.debug(`📦 storage client with id: '${input.id}' initiated`)
  // TODO: Support more browsers
  const { chromeAPI, getConnectionPassword } = makeChromeApi(input.id)
  const subscription = storageSubscriptions(input.subjects, chromeAPI)

  const destroy = () => {
    subscription.unsubscribe()
  }

  return {
    subjects: input.subjects,
    destroy,
    id: input.id,
    getConnectionPassword,
  }
}
