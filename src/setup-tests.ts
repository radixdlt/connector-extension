// eslint-disable-next-line @typescript-eslint/no-require-imports
require('dotenv').config()
import { randomUUID, webcrypto } from 'node:crypto'
import { chrome } from 'jest-chrome'

// @ts-ignore
global.chrome = chrome
// @ts-ignore
global.chrome.storage.local.get = () => Promise.resolve()
global.chrome.storage.local.set = () => Promise.resolve()
// @ts-ignore
global.crypto.subtle = webcrypto.subtle
global.crypto.randomUUID = randomUUID

import(process.env.CI ? 'wrtc' : '@koush/wrtc').then((webRTC) => {
  global.RTCPeerConnection = webRTC.RTCPeerConnection
  global.RTCIceCandidate = webRTC.RTCIceCandidate
  global.RTCSessionDescription = webRTC.RTCSessionDescription
})
