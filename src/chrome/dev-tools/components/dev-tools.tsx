import { Box } from 'components'
import { SignalingServer } from './signaling-server'
import { ConnectionStatus } from './connection-status'
import { Message } from './message'
import { ConnectionSecret } from './connection-secret'

export const DevTools = () => (
  <Box p="medium">
    <SignalingServer />
    <ConnectionStatus />
    <ConnectionSecret />
    <Message />
  </Box>
)
