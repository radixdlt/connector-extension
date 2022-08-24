// eslint-disable-next-line @typescript-eslint/no-require-imports
require('dotenv').config()
import { Crypto } from '@peculiar/webcrypto'
import { chrome } from 'jest-chrome'

global.crypto = new Crypto()
global.chrome = chrome

import(process.env.CI ? 'wrtc' : '@koush/wrtc').then((webRTC) => {
  global.RTCPeerConnection = webRTC.RTCPeerConnection
  global.RTCIceCandidate = webRTC.RTCIceCandidate
  global.RTCSessionDescription = webRTC.RTCSessionDescription
})
