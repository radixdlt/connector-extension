/* eslint-disable max-nested-callbacks */
import { Box, Text } from 'components'

export const PreviewMessage = ({ text }: { text: string }) => (
  <Box>
    <Text>Incoming message:</Text>
    <pre
      style={{
        padding: 10,
        background: '#eeeeee',
        fontFamily: 'monospace',
        overflow: 'auto',
      }}
    >
      {text}
    </pre>
  </Box>
)
