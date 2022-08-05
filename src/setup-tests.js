import { Crypto } from '@peculiar/webcrypto'
import { chrome } from 'jest-chrome'

import webRTC from 'wrtc'

global.crypto = new Crypto()
global.chrome = chrome
global.RTCPeerConnection = webRTC.RTCPeerConnection
global.RTCIceCandidate = webRTC.RTCIceCandidate
global.RTCSessionDescription = webRTC.RTCSessionDescription
