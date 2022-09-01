import { WebRtcContext } from 'contexts/web-rtc-context'
import { useContext } from 'react'

export const useWebRtcSendMessage = () => {
  const webRtc = useContext(WebRtcContext)
  return (message: string) => {
    webRtc?.webRtc.subjects.rtcAddMessageToQueue.next(message)
  }
}
