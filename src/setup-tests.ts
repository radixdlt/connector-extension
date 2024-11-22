// @ts-nocheck

import dotenv from 'dotenv'
import path from 'node:path'
import { chrome } from 'vitest-chrome/lib/index.esm.js'
import { vi } from 'vitest'
import { randomUUID, webcrypto } from 'node:crypto'

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

type OnMessageListener = (message: any) => void
type OnConnectListener = (port: any) => void

const getMockChrome = vi.fn(() => {
  const linkPortOnMessageListeners: OnMessageListener[] = []
  const handlerPortOnMessageListeners: OnMessageListener[] = []
  const handlerPortOnConnectListeners: OnConnectListener[] = []

  return {
    runtime: {
      connect: vi.fn(() => {
        const handlerPort = {
          postMessage: vi.fn((message) => {
            linkPortOnMessageListeners.forEach((listener) => listener(message))
          }),
          onMessage: {
            addListener: vi.fn((listener) => {
              handlerPortOnMessageListeners.push(listener)
            }),
            removeListener: vi.fn(),
          },
          onDisconnect: {
            addListener: vi.fn(),
            removeListener: vi.fn(),
          },
        }

        const linkPort = {
          postMessage: vi.fn((message) => {
            handlerPortOnMessageListeners.forEach((listener) =>
              listener(message),
            )
          }),
          onMessage: {
            addListener: vi.fn((listener) => {
              linkPortOnMessageListeners.push(listener)
            }),
            removeListener: vi.fn(),
          },
          onDisconnect: {
            addListener: vi.fn(),
            removeListener: vi.fn(),
          },
        }

        handlerPortOnConnectListeners.forEach((listener) =>
          listener(handlerPort),
        )

        return linkPort
      }),
      onConnect: {
        addListener: vi.fn((listener) => {
          handlerPortOnConnectListeners.push(listener)
        }),
      },
    },
  }
})

export const resetMocks = () => {
  // @ts-expect-error mocking chrome
  const {
    runtime: { connect, onConnect },
  } = getMockChrome()
  chrome.runtime.connect = connect
  chrome.runtime.onConnect = onConnect
}

resetMocks()

global.chrome = chrome

if (!global?.crypto?.subtle) global.crypto.subtle = webcrypto.subtle
if (!global?.crypto?.randomUUID) global.crypto.randomUUID = randomUUID
