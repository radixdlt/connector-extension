import { config } from 'config'
import { map, Subscription } from 'rxjs'
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

  let rtcOutgoingMessageSubjectSubscription: Subscription | undefined

  const dataChannel = peerConnection.createDataChannel('data', {
    negotiated: config.environment !== 'test',
    id: 0,
    ordered: true,
  })

  dataChannel.onmessage = (ev) => {
    rtcIncomingMessageSubject.next(ev.data)
  }

  dataChannel.onopen = () => {
    rtcOutgoingMessageSubjectSubscription = rtcOutgoingMessageSubject
      .pipe(
        map(sendMessage)
        // parseResponse (zod),
        // check valid,
      )
      .subscribe()

    rtcStatusSubject.next('connected')
  }

  dataChannel.onclosing = () => {
    rtcOutgoingMessageSubjectSubscription?.unsubscribe()
  }

  dataChannel.onclose = () => {
    rtcStatusSubject.next('disconnected')
  }

  const sendMessage = (message: string) => {
    dataChannel.send(message)
  }

  return {
    peerConnection,
  }
}
