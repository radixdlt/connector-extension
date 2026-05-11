const isChromeDefined = typeof chrome !== 'undefined'

export const hasOffscreen = (): boolean =>
  isChromeDefined && chrome.offscreen !== undefined

export const hasIdle = (): boolean =>
  isChromeDefined &&
  chrome.idle !== undefined &&
  chrome.idle.onStateChanged !== undefined

export const hasStorageSession = (): boolean =>
  isChromeDefined &&
  chrome.storage !== undefined &&
  'session' in chrome.storage

export const hasSystemDisplay = (): boolean =>
  isChromeDefined &&
  'system' in chrome &&
  (chrome.system as any)?.display !== undefined

export const getSessionStorageArea = (): chrome.storage.StorageArea => {
  if (hasStorageSession()) {
    return chrome.storage.session
  }
  return chrome.storage.local
}
