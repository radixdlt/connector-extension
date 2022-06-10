import Icon from 'components/icon'
import Box from 'components/box'
import Button from 'components/button'
import Tooltip from 'components/tooltip'
import Encryptionkey from 'containers/encryptionkey'
import Connecting from 'containers/connecting'
import { animated, config, useTransition } from '@react-spring/web'
import { useState } from 'react'
import { usePrevious } from 'react-use'
import { styled } from 'stitches.config'
import Connected from 'containers/connected'

const AnimatedBox = styled(animated.div, {
  position: 'absolute',
  width: '85%',
  top: 70,
  zIndex: 0,
})

const Main = () => {
  const [step, setStep] = useState<keyof typeof steps>(1)
  const prevStep = usePrevious(step)

  const steps = {
    1: <Encryptionkey onNext={() => setStep(2)} />,
    2: <Connecting onNext={() => setStep(3)} />,
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
    <Box css={{ width: '180px', height: '340px' }} p="small" flex="col">
      <Box py="small" items="center" justify="between">
        <img height="18" width="68" src="assets/images/logo.png" />
        <Tooltip description="Re-generate code">
          <Button border="none" ghost size="iconSmall">
            <Icon color="$secondary" size="small" type="refresh" />
          </Button>
        </Tooltip>
      </Box>
      {transitions((styles, item) => (
        <AnimatedBox style={styles}>{steps[item]}</AnimatedBox>
      ))}
    </Box>
  )
}

export default Main
