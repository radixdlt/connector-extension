import Icon from 'components/icon'
import Box from 'components/box'
import Button from 'components/button'
import Tooltip from 'components/tooltip'
import Connecting from 'containers/connecting'
import { animated, config, useTransition } from '@react-spring/web'
import { useContext, useState, useEffect } from 'react'
import { usePrevious } from 'react-use'
import { styled } from 'stitches.config'
import { Connected } from 'containers/connected/connected'
import { EncryptionKey } from 'containers/encryptionkey'
import logo from 'images/logo.png'
import { useSaveConnectionPassword } from 'hooks/use-save-connection-password'
import { WebRtcContext } from 'contexts/web-rtc-context'
import { config as appConfig } from '../../config'
import { Subscription, tap } from 'rxjs'

const AnimatedBox = styled(animated.div, {
  position: 'absolute',
  width: '100%',
  left: 0,
  top: 70,
  zIndex: 0,
})

export const Setup = () => {
  const webRtc = useContext(WebRtcContext)
  useSaveConnectionPassword()
  const [step, setStep] = useState<keyof typeof steps>(1)
  const prevStep = usePrevious(step)

  useEffect(() => {
    webRtc?.storage.getConnectionPassword().map((secret) => {
      if (!secret)
        webRtc.signaling.subjects.wsGenerateConnectionSecretsSubject.next()

      return undefined
    })

    const subscriptions = new Subscription()

    subscriptions.add()

    subscriptions.add(
      webRtc?.webRtc.subjects.rtcStatusSubject
        .pipe(
          tap((status) => {
            if (status === 'connected') setStep(3)
          })
        )
        .subscribe()
    )

    return () => {
      subscriptions?.unsubscribe()
    }
  }, [webRtc])

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
    3: <Connected />,
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
    <Box css={{ height: '340px', position: 'relative' }} p="small" flex="col">
      <Box py="small" items="center" justify="between">
        <Box flex="col">
          <Box flex="row">
            <img height="18" width="68" src={logo} />
            <Box css={{ alignSelf: 'center', ml: '$sm', p: '$0' }}>
              {appConfig.version}
            </Box>
          </Box>
        </Box>

        <Tooltip description="Re-generate code">
          <Button border="none" ghost size="iconSmall">
            <Icon
              color="$secondary"
              size="small"
              type="refresh"
              onClick={async () => {
                setStep(1)
                await webRtc?.storage.removeConnectionPassword()
              }}
            />
          </Button>
        </Tooltip>
      </Box>

      {transitions((styles, item) => (
        <AnimatedBox style={styles}>{steps[item]}</AnimatedBox>
      ))}
    </Box>
  )
}
