import Box from 'components/box'
import { useHover } from 'react-use'
import OverlayC from './overlay'

export const Overlay = () => {
  const element = (hovered: boolean) => (
    <Box position="relative">
      <OverlayC show={hovered} />
      Hover me
    </Box>
  )

  const [hoverable] = useHover(element)
  return <Box>{hoverable}</Box>
}
