import { ChromeApi } from 'chrome/chrome-api'
import { Logger } from 'loglevel'
import { StorageSubjectsType } from './subjects'
import { storageSubscriptions } from './subscriptions'
import { Buffer } from 'buffer'
import { sessionStore } from 'chrome/helpers/set-item'

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

  const onActiveConnectionsChange = (changes: {
    [key: string]: chrome.storage.StorageChange
  }) => {
    if (!changes) return
    const activeConnections = Object.entries(changes).filter(
      ([key, value]) => key.includes('connection:') && value.newValue
    )
    input.logger.debug(
      `📦🔌 active connections\n ${JSON.stringify(changes, null, 2)}`
    )
    input.subjects.activeConnections.next(activeConnections.length > 0)
  }

  sessionStore.getItem(null).map((items) => {
    if (!items) return
    const activeConnections = Object.entries(items).filter(
      ([key, value]) => key.includes('connection:') && value
    )
    input.logger.debug(
      `📦🔌 active connections ${JSON.stringify(items, null, 2)}`
    )
    input.subjects.activeConnections.next(activeConnections.length > 0)
  })

  chrome.storage.session.onChanged.addListener((changes) =>
    onActiveConnectionsChange(changes)
  )
  chromeAPI.storage.addListener(onPasswordChange)

  const destroy = () => {
    chromeAPI.storage.removeListener(onPasswordChange)
    chrome.storage.session.onChanged.removeListener(onActiveConnectionsChange)
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
