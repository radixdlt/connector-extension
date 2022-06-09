import { animated, useTransition } from '@react-spring/web'
import { styled } from 'stitches.config'

interface OverlayProps {
  show: boolean
}

const Overlay = ({ show }: OverlayProps) => {
  const transitions = useTransition(show, {
    from: { opacity: 0 },
    enter: { opacity: 0.5 },
    leave: { opacity: 0 },
    delay: 0,
    config: { mass: 1, tension: 680, friction: 100 },
  })

  const OverlayElement = styled(animated.div, {
    backgroundColor: '$primary',
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  })

  return transitions(
    (styles, show) => show && <OverlayElement style={styles} />
  )
}

export default Overlay
