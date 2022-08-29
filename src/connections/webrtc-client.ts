import {
  SignalingServerClient,
  SignalingServerClientInput,
} from 'connections/signaling-server-client'
import { WebRtcSubjectsType } from 'connections/subjects'
import { WebRtcSubscriptions } from 'connections/subscriptions'
import { WebRtc } from 'connections/webrtc'

export type WebRtcClient = ReturnType<typeof WebRtcClient>
export type WebRtcClientInput = {
  subjects: WebRtcSubjectsType
  signalingServerOptions: Omit<SignalingServerClientInput, 'subjects'>
  webRtcOptions: Omit<Parameters<typeof WebRtc>[0], 'subjects'>
}

export const WebRtcClient = (input: WebRtcClientInput) => {
  const subjects = input.subjects
  const subscriptions = WebRtcSubscriptions(subjects)
  const signalingServerClient = SignalingServerClient({
    baseUrl: input.signalingServerOptions.baseUrl,
    source: input.signalingServerOptions.source,
    target: input.signalingServerOptions.target,
    subjects,
  })
  const webRtc = WebRtc({
    subjects,
    peerConnectionConfig: input.webRtcOptions.peerConnectionConfig,
    dataChannelConfig: input.webRtcOptions.dataChannelConfig,
  })

  const destroy = () => {
    subjects.wsConnectSubject.next(false)
    signalingServerClient.destroy()
    subjects.rtcConnectSubject.next(false)
    webRtc.destroy()
    subscriptions.unsubscribe()
  }

  return {
    subjects,
    signalingServerClient,
    webRtc,
    destroy,
  }
}
