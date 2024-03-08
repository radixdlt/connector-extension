// @ts-nocheck

import dotenv from 'dotenv'
import { randomUUID, webcrypto } from 'node:crypto'
import { chrome } from 'jest-chrome'
import path from 'node:path'

const mode = process.env['MODE'] || 'development'

dotenv.config({
  path: path.join(__dirname, `../.env.${mode}`),
})

global.navigator.hid = {
  requestDevice: () => Promise.resolve([]),
  getDevices: () => Promise.resolve([]),
}

global.CSS = {
  supports: (k, v) => false,
}
global.chrome = chrome
global.chrome.storage = {
  onChanged: {
    addListener: () => {},
    removeListener: () => {},
  },
  local: {
    get: () => Promise.resolve(),
    set: () => Promise.resolve(),
  },
  session: {
    get: () => Promise.resolve(),
    set: () => Promise.resolve(),
    remove: () => Promise.resolve(),
    onChanged: {
      addListener: () => {},
      removeListener: () => {},
    },
  },
}
global.chrome.runtime = {
  sendMessage: () => Promise.resolve(),
  onMessage: {
    addListener: () => {},
    removeListener: () => {},
  },
}

global.crypto.subtle = webcrypto.subtle
global.crypto.randomUUID = randomUUID
