import { WebRtcSubjectsType } from 'webrtc/subjects'
import { WebRtcSubscriptions } from 'webrtc/subscriptions'
import { WebRtc } from 'webrtc/webrtc'

export type WebRtcClient = ReturnType<typeof WebRtcClient>
export type WebRtcClientInput = {
  subjects: WebRtcSubjectsType
  webRtcOptions: Omit<Parameters<typeof WebRtc>[0], 'subjects'>
}

export const WebRtcClient = (input: WebRtcClientInput) => {
  const subjects = input.subjects

  const webRtc = WebRtc({
    subjects,
    peerConnectionConfig: input.webRtcOptions.peerConnectionConfig,
    dataChannelConfig: input.webRtcOptions.dataChannelConfig,
  })

  const subscriptions = WebRtcSubscriptions(subjects, webRtc)

  const destroy = () => {
    subjects.rtcConnectSubject.next(false)
    webRtc.destroy()
    subscriptions.unsubscribe()
  }

  return {
    subjects,
    webRtc,
    destroy,
  }
}
