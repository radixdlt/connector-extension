import { useContext, useEffect, useState } from 'react'
import { ScanQrCode } from './components/scan-qr'
import { useConnectionPassword } from 'hooks/use-connection-password'
import { useGenerateConnectionPassword } from 'hooks/use-generate-connection-password'
import { usePairingState } from 'hooks/use-paring-state'
import { ConnectionStatus } from './components/connection-status'
import { WebRtcContext } from 'contexts/web-rtc-context'
import { PopupWindow } from 'components'
import { useActiveConnections } from 'hooks/use-active-connections'
import { useWebRtcStatus } from 'hooks/use-webrtc-status'

type ParingProps = { onPassword?: (password: string) => void }

export const Paring = ({ onPassword }: ParingProps) => {
  useGenerateConnectionPassword()
  const [step, setStep] = useState<keyof typeof steps>(0)
  const connectionPassword = useConnectionPassword()
  const pairingState = usePairingState()
  const webRtc = useContext(WebRtcContext)
  const activeConnections = useActiveConnections()
  const webRtcStatus = useWebRtcStatus()

  const forgetWallet = () => {
    webRtc?.signaling.subjects.wsRegenerateConnectionPassword.next()
    webRtc?.webRtc.subjects.rtcRestartSubject.next()
  }

  useEffect(() => {
    const connect = (connect: boolean) => {
      webRtc?.signaling.subjects.wsConnectSubject.next(connect)
      webRtc?.webRtc.subjects.rtcConnectSubject.next(connect)
    }

    if (pairingState === 'notPaired') {
      setStep(1)
      connect(true)
    } else if (pairingState === 'paired') {
      setStep(2)
    }

    if (webRtcStatus === 'connected') {
      connect(false)
    }

    if (pairingState === 'notPaired' && connectionPassword && onPassword)
      onPassword(connectionPassword)
  }, [pairingState, connectionPassword, onPassword, webRtcStatus, webRtc])

  const steps = {
    0: null,
    1: <ScanQrCode connectionPassword={connectionPassword} />,
    2: (
      <ConnectionStatus
        activeConnection={activeConnections}
        onForgetWallet={() => forgetWallet()}
      />
    ),
  }

  return <PopupWindow>{steps[step]}</PopupWindow>
}
