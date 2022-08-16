import { subjects } from 'connections'

export const useWebRtcSendMessage = () => (message: string) => {
  subjects.rtcOutgoingMessageSubject.next(message)
}
