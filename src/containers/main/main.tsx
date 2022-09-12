import Box from 'components/box'
import Connecting from 'containers/connecting'
import { animated, config, useTransition } from '@react-spring/web'
import { useContext, useEffect, useState } from 'react'
import { usePrevious } from 'react-use'
import { styled } from 'stitches.config'
import { ChatBox } from 'containers/chat-box/chat-box'
import { EncryptionKey } from 'containers/encryptionkey'
import logo from 'images/logo.png'
import { useWebRtcDataChannelStatus } from 'hooks/use-rtc-data-channel-status'
import { useConnectionSecrets } from 'hooks/use-connection-secrets'
import { useAutoConnect } from 'hooks/use-auto-connect'
import { WebRtcContext } from 'contexts/web-rtc-context'
import { config as appConfig } from '../../config'

const AnimatedBox = styled(animated.div, {
  position: 'absolute',
  width: '85%',
  top: 70,
  zIndex: 0,
})

export const Main = () => {
  const webRtc = useContext(WebRtcContext)
  const connectionSecret = useConnectionSecrets()
  const autoConnect = useAutoConnect()
  const status = useWebRtcDataChannelStatus()
  const [step, setStep] = useState<keyof typeof steps>(1)
  const prevStep = usePrevious(step)

  useEffect(() => {
    if (!webRtc) return
    if (connectionSecret?.isOk() && step === 1 && autoConnect) {
      webRtc.signaling.subjects.wsConnectSubject.next(true)
      setStep(2)
    } else if (step === 1) return
    else if (
      ['connecting', 'disconnected'].includes(status || '') &&
      step !== 2
    )
      setStep(2)
    else if (status === 'connected' && step !== 3) setStep(3)
  }, [step, status, connectionSecret, autoConnect])

  const steps = {
    1: (
      <EncryptionKey
        onNext={() => {
          webRtc?.signaling.subjects.wsConnectSubject.next(true)
          return setStep(2)
        }}
      />
    ),
    2: <Connecting />,
    3: <ChatBox />,
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

  return (
    <Box css={{ width: '180px', height: '340px' }} p="small" flex="col">
      <Box py="small" items="center" justify="between">
        <Box flex="col">
          <Box flex="row">
            <img height="18" width="68" src={logo} />
            <Box css={{ alignSelf: 'center', ml: '$sm', p: '$0' }}>
              {appConfig.version}
            </Box>
          </Box>
        </Box>
      </Box>

      {transitions((styles, item) => (
        <AnimatedBox style={styles}>{steps[item]}</AnimatedBox>
      ))}
    </Box>
  )
}
