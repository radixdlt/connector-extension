import { Box } from 'components'
import { SignalingServer } from './signaling-server'
import { ConnectionStatus } from './connection-status'
import { IncomingMessage } from './incoming-message'
import { ConnectionSecret } from './connection-secret'

export const DevToolsWrapper = () => (
  <Box p="medium">
    <SignalingServer />
    <ConnectionStatus />
    <ConnectionSecret />
    <IncomingMessage />
  </Box>
)
