import Box from 'components/box'
import { useWebRtcIncomingMessage } from 'hooks/use-rtc-incoming-message'
import { useWebRtcSendMessage } from 'hooks/use-rtc-send-message'
import { useEffect, useState } from 'react'

export const Connected = () => {
  const [messages, setMessages] = useState<string[]>([])
  const [outgoingMessage, setOutgoingMessage] = useState<string>('')
  const sendMessage = useWebRtcSendMessage()
  const incomingMessage = useWebRtcIncomingMessage()

  useEffect(() => {
    if (incomingMessage) {
      setMessages((prev) => [...prev, `⬇️ ${incomingMessage}`])
    }
  }, [incomingMessage])

  return (
    <Box css={{ height: '250px' }} justify="center" items="center">
      {/* <Box>
        <Icon color="$success" type="check" />{' '}
        <Text ml="xsmall">Connected</Text>
      </Box> */}

      <form
        onSubmit={(ev) => {
          ev.preventDefault()
          setMessages((prev) => [...prev, `⬆️ ${outgoingMessage}`])
          sendMessage(outgoingMessage)
          setOutgoingMessage('')
        }}
      >
        <Box
          css={{ border: '1px solid black', height: '200px' }}
          border
          p="small"
        >
          {messages.map((message) => (
            <div key={message}>{message}</div>
          ))}
        </Box>
        <input
          value={outgoingMessage}
          onChange={(event) => setOutgoingMessage(event.target.value)}
        />
        <button type="submit">Send message</button>
      </form>
    </Box>
  )
}
