import { ChromeApi } from 'chrome/chrome-api'
import { Logger } from 'loglevel'
import { StorageSubjectsType } from './subjects'
import { storageSubscriptions } from './subscriptions'
import { Buffer } from 'buffer'

export const makeChromeApi = (id: string, logger: Logger) => {
  const chromeAPI = ChromeApi(id, logger)
  const getConnectionPassword = () =>
    chromeAPI.storage.getItem<string>('connectionPassword')
  const removeConnectionPassword = () =>
    chromeAPI.storage.removeItem('connectionPassword')
  return { chromeAPI, getConnectionPassword, removeConnectionPassword }
}

export type StorageClientType = ReturnType<typeof StorageClient>
export type StorageInput = {
  id: string
  subjects: StorageSubjectsType
  logger: Logger
}
export const StorageClient = (input: StorageInput) => {
  input.logger.debug(`📦 storage client with id: '${input.id}' initiated`)
  // TODO: Support more browsers
  const { chromeAPI, getConnectionPassword, removeConnectionPassword } =
    makeChromeApi(input.id, input.logger)
  const subscription = storageSubscriptions(input.subjects, chromeAPI)

  const onPasswordChange = (changes: {
    [key: string]: chrome.storage.StorageChange
  }) => {
    const value = changes[`${input.id}:connectionPassword`]
    if (changes[`${input.id}:connectionPassword`]) {
      input.logger.debug(
        `🔐 detected password change\n${JSON.stringify(value)}`
      )
      input.subjects.onPasswordChange.next(
        value.newValue ? Buffer.from(value.newValue, 'hex') : undefined
      )
    }
  }

  chromeAPI.storage.addListener(onPasswordChange)

  const destroy = () => {
    chromeAPI.storage.removeListener(onPasswordChange)
    subscription.unsubscribe()
  }

  return {
    subjects: input.subjects,
    destroy,
    id: input.id,
    getConnectionPassword,
    removeConnectionPassword,
    chromeAPI,
  }
}
