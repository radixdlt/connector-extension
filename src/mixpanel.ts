import { config } from 'config'
import mx from 'mixpanel-browser'

type trackers =
  | 'webrtc_connecting'
  | 'webrtc_connected'
  | 'webrtc_disconnected'
  | 'webrtc_message_send'
  | 'webrtc_message_send_confirmed'
  | 'webrtc_message_send_failed'
  | 'ws_connecting'
  | 'ws_connected'
  | 'ws_disconnected'

mx.init(config.mixpanel.token, { secure_cookie: true })

export const setConnectionId = (connectionId: string) => {
  if (process.env.NODE_ENV !== 'production') return
  return mx.identify(connectionId)
}

export const track = (tracker: trackers, data?: Record<string, any>) => {
  if (process.env.NODE_ENV !== 'production') return
  return mx.track(tracker, data)
}
