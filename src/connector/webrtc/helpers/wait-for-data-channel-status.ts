import { filter } from 'rxjs'
import { WebRtcClient } from '../webrtc-client'

export const waitForDataChannelStatus = (
  webRtcClient: WebRtcClient,
  value: 'open' | 'closed'
) =>
  webRtcClient.subjects.dataChannelStatusSubject.pipe(
    filter((status) => status === value)
  )
