// @ts-nocheck

import dotenv from 'dotenv'
import { randomUUID, webcrypto } from 'node:crypto'
import { chrome } from 'jest-chrome'

dotenv.config()

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

global.crypto.subtle = webcrypto.subtle
global.crypto.randomUUID = randomUUID

import(process.env.CI ? 'wrtc' : '@koush/wrtc').then((webRTC) => {
  global.RTCPeerConnection = webRTC.RTCPeerConnection
  global.RTCIceCandidate = webRTC.RTCIceCandidate
  global.RTCSessionDescription = webRTC.RTCSessionDescription
})
