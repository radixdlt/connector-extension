import { Text } from 'components'
import { Status } from 'connector'
import { useConnectionStatus } from 'hooks/use-connection-status'

const renderStatusIcon = (connectionStatus: Status | undefined) => {
  if (connectionStatus === 'connected') {
    return `🟢`
  } else if (connectionStatus === 'disconnected') {
    return '🔴'
  } else {
    return `⚪️`
  }
}

export const ConnectionStatus = () => {
  const connectionStatus = useConnectionStatus()

  return <Text>🕸 Data channel: {renderStatusIcon(connectionStatus)}</Text>
}
