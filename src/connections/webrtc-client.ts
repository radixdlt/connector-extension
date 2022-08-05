import { SignalingServerClient } from 'connections/signaling-server-client'
import { Subjects, WebRtc, MessageHandler } from 'connections'

type WebRTCType = ReturnType<typeof WebRtc>
type SignalingServerClient = ReturnType<typeof SignalingServerClient>
type SubjectsType = ReturnType<typeof Subjects>
type MessageHandler = ReturnType<typeof MessageHandler>

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
  const messageHandler = MessageHandler(subjects)
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
    messageHandler.subscriptions.unsubscribe()
    subjects.wsConnectSubject.next(false)
    webRtc.destroy()
  }

  return {
    subjects,
    messageHandler,
    signalingServerClient,
    webRtc,
    destroy,
  }
}
