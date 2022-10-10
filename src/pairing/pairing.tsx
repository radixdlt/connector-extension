import { PopupWindow } from 'components'
import { animated, config, useTransition } from '@react-spring/web'
import { useEffect, useState } from 'react'
import { usePrevious } from 'react-use'
import { styled } from 'stitches.config'
import { ScanQrCode } from './scan-qr'
import { useConnectionPassword } from 'hooks/use-connection-password'
import { useConnect } from 'hooks/use-connect'
import { useGenerateConnectionPassword } from 'hooks/use-generate-connection-password'
import { usePairingState } from 'hooks/use-paring-state'

const AnimatedBox = styled(animated.div, {
  position: 'absolute',
  width: '100%',
  left: 0,
  top: 70,
  zIndex: 0,
})

type ParingProps = { onPassword?: (password: string) => void }

export const Paring = ({ onPassword }: ParingProps) => {
  useConnect(true)
  useGenerateConnectionPassword()
  const [step, setStep] = useState<keyof typeof steps>(1)
  const prevStep = usePrevious(step)
  const connectionPassword = useConnectionPassword()
  const pairingState = usePairingState()

  useEffect(() => {
    if (pairingState === 'notPaired' && connectionPassword && onPassword)
      onPassword(connectionPassword)
  }, [pairingState, connectionPassword, onPassword])

  const steps = {
    1: <ScanQrCode connectionPassword={connectionPassword} />,
  }

  const transitions = useTransition(step, {
    initial: {},
    from: {
      opacity: 0,
      transform: `translateX(${prevStep! < step ? 70 : -70}px) scale(0.9)`,
    },
    enter: {
      opacity: 1,
      transform: `translateX(0px) scale(1)`,
    },
    leave: {
      opacity: 0,
      transform: `translateX(${prevStep! < step ? -70 : 70}px) scale(0.9)`,
    },
    config: config.gentle,
  })

  return <PopupWindow>{steps[step]}</PopupWindow>
}
