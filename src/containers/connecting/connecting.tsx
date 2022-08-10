import Box from 'components/box'
import { useWebRtcDataChannelStatus } from 'hooks/use-rtc-data-channel-status'

type ConnectingProps = {
  onNext: () => void
}

const Connecting = ({ onNext }: ConnectingProps) => {
  const status = useWebRtcDataChannelStatus()

  if (status === 'connected') {
    setTimeout(() => {
      onNext()
    })
  }

  return (
    <Box css={{ height: '250px' }} justify="center" items="center">
      Connecting...
    </Box>
  )
}

export default Connecting
