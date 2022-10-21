import { Logger } from 'loglevel'
import { StorageSubjectsType } from './subjects'
import { storageSubscriptions } from './subscriptions'
import { Buffer } from 'buffer'
import { createChromeApi } from 'chrome/chrome-api'

export type StorageClientType = ReturnType<typeof StorageClient>
export type StorageInput = {
  id: string
  subjects: StorageSubjectsType
  logger: Logger
}
export const StorageClient = (input: StorageInput) => {
  input.logger.debug(`📦 storage client with id: '${input.id}' initiated`)

  const { chromeAPI, getConnectionPassword, removeConnectionPassword } =
    createChromeApi(input.id, input.logger)

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
