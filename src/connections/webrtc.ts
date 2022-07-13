import { config } from 'config'
import { map } from 'rxjs'
import {
  rtcStatusSubject,
  rtcIncommingMessageSubject,
  rtcOutgoingMessageSubject,
} from './subjects'

export const makeWebRTC = () => {
  const peerConnection = new RTCPeerConnection({
    iceServers: config.iceServers, // disable if test mode
  })

  const dataChannel = peerConnection.createDataChannel('data', {
    negotiated: true,
    id: 0,
    ordered: true,
  })

  dataChannel.onmessage = (ev) => {
    rtcIncommingMessageSubject.next(ev.data)
  }

  dataChannel.onopen = () => {
    console.log('dataChannel open')
    rtcStatusSubject.next('open')
  }

  dataChannel.onclose = () => {
    console.log('dataChannel closed')
    rtcStatusSubject.next('closed')
  }

  const sendMessage = (message: string) => {
    dataChannel.send(message)
  }

  rtcOutgoingMessageSubject
    .pipe(
      map(sendMessage)
      // parseResponse (zod),
      // check valid,
    )
    .subscribe()

  return {
    peerConnection,
  }
}
