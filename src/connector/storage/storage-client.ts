import log, { Logger } from 'loglevel'
import { StorageSubjects, StorageSubjectsType } from './subjects'
import { storageSubscriptions } from './subscriptions'
import { Buffer } from 'buffer'
import { createChromeApi } from 'chrome/chrome-api'

export type StorageClientType = ReturnType<typeof StorageClient>
export type StorageInput = {
  id?: string
  subjects?: StorageSubjectsType
  logger?: Logger
}
export const StorageClient = ({
  id = crypto.randomUUID(),
  subjects = StorageSubjects(),
  logger = log,
}: StorageInput) => {
  logger.debug(`📦 storage client with id: '${id}' initiated`)

  const { chromeAPI, getConnectionPassword, removeConnectionPassword } =
    createChromeApi(id, logger)

  const subscription = storageSubscriptions(subjects, chromeAPI)

  const onPasswordChange = (changes: {
    [key: string]: chrome.storage.StorageChange
  }) => {
    const value = changes[`${id}:connectionPassword`]
    if (changes[`${id}:connectionPassword`]) {
      logger.debug(`🔐 detected password change\n${JSON.stringify(value)}`)
      subjects.onPasswordChange.next(
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
    subjects,
    destroy,
    id,
    getConnectionPassword,
    removeConnectionPassword,
    chromeAPI,
  }
}
