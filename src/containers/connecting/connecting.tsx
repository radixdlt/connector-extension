import Box from 'components/box'
import { useEffect } from 'react'

interface ConnectingProps {
  onNext: () => void
}

const Connecting = ({ onNext }: ConnectingProps) => {
  useEffect(() => {
    setTimeout(onNext, 1000)
  }, [])

  return (
    <Box css={{ height: '250px' }} justify="center" items="center">
      Connecting...
    </Box>
  )
}

export default Connecting
