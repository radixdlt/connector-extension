import { SignalingServerClient } from 'connections/signaling-server-client'
import { Subjects, WebRtc, Subscriptions, SubjectsType } from 'connections'

export type WebRtcClient = ReturnType<typeof WebRtcClient>
export type WebRtcClientInput = {
  subjects?: SubjectsType
  signalingServerOptions: Omit<
    Parameters<typeof SignalingServerClient>[0],
    'subjects'
  >
  webRtcOptions: Omit<Parameters<typeof WebRtc>[0], 'subjects'>
}

export const WebRtcClient = (input: WebRtcClientInput) => {
  const subjects = input.subjects || Subjects()
  const subscriptions = Subscriptions(subjects)
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
