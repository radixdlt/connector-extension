import { config } from 'config'
import { map } from 'rxjs'
import {
  rtcStatusSubject,
  rtcIncomingMessageSubject,
  rtcOutgoingMessageSubject,
} from '../subjects'

export const makeWebRTC = () => {
  const { environment, iceServers } = config
  const peerConnection = new RTCPeerConnection(
    environment !== 'test' ? { iceServers } : undefined
  )

  const dataChannel = peerConnection.createDataChannel('data', {
    negotiated: config.environment !== 'test',
    id: 0,
    ordered: true,
  })

  dataChannel.onmessage = (ev) => {
    rtcIncomingMessageSubject.next(ev.data)
  }

  dataChannel.onopen = () => {
    rtcStatusSubject.next('connected')
  }

  dataChannel.onclose = () => {
    rtcStatusSubject.next('disconnected')
  }

  const sendMessage = (message: string) => {
    if (dataChannel.readyState === 'open') dataChannel.send(message)
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
