import Box from 'components/box'
import { useWebRtcIncomingMessage } from 'hooks/use-rtc-incoming-message'
import { useWebRtcSendMessage } from 'hooks/use-rtc-send-message'
import { useEffect, useState } from 'react'

const tenMB = new Array(1_000 * 10)
  .fill(null)
  .map(
    () =>
      `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aenean eu odio consectetur, varius lorem quis, finibus enim. Aliquam erat volutpat. Vivamus posuere sit amet justo ut vulputate. Nam ultrices nec tortor at pulvinar. Nunc et nibh purus. Donec vehicula venenatis risus eu sollicitudin. Sed posuere eu odio ac semper. Sed vitae est id dui blandit aliquet. Sed dapibus mi dui, ut rhoncus dolor aliquet tempus. Nam fermentum justo a arcu egestas, id laoreet urna condimentum. Nunc auctor elit sed arcu lobortis, a tincidunt libero mollis. Etiam hendrerit eu risus eget porttitor. Donec vitae neque vehicula, cursus magna eget, mollis metus. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae; Vestibulum vel facilisis diam. Sed non tortor ultricies, viverra mauris tempor, cursus justo. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae; Vestibulum vel facilisis diam. Sed non tortor ultricies, viverra mauris tempor, cursu. `
  )
  .join('')

const oneMB = tenMB.slice(0, tenMB.length / 10)

export const Connected = () => {
  const [messages, setMessages] = useState<string[]>([])
  const [messageCounter, setMessageCounter] = useState<number>(0)
  const [outgoingMessage, setOutgoingMessage] = useState<string>('')
  const sendMessage = useWebRtcSendMessage()
  const incomingMessage = useWebRtcIncomingMessage()

  useEffect(() => {
    if (incomingMessage && incomingMessage.length < 1000) {
      setMessageCounter((prev) => prev + 1)
      setMessages((prev) => [...prev, `⬇️ ${incomingMessage}`])
    } else if (incomingMessage && incomingMessage.length >= 1000) {
      setMessageCounter((prev) => prev + 1)
    }
  }, [incomingMessage])

  return (
    <Box css={{ height: '250px' }} justify="center" items="center" flex="col">
      {/* <Box>
        <Icon color="$success" type="check" />{' '}
        <Text ml="xsmall">Connected</Text>
      </Box> */}
      <Box>Received messages: {messageCounter}</Box>
      <form
        style={{ height: '100%', overflow: 'auto' }}
        onSubmit={(ev) => {
          ev.preventDefault()
          setMessages((prev) => [...prev, `⬆️ ${outgoingMessage}`])
          sendMessage(outgoingMessage)
          setOutgoingMessage('')
        }}
      >
        <Box
          css={{ border: '1px solid black', height: '150px', overflow: 'auto' }}
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
        <Box flex="col">
          <button
            style={{ marginTop: 10 }}
            type="button"
            onClick={() => {
              sendMessage(oneMB.slice(0, oneMB.length / 10))
            }}
          >
            Send 0.1MB message
          </button>
          <button
            style={{ marginTop: 10 }}
            type="button"
            onClick={() => {
              sendMessage(oneMB.slice(0, oneMB.length / 5))
            }}
          >
            Send 0.25MB message
          </button>
          <button
            style={{ marginTop: 10 }}
            type="button"
            onClick={() => {
              sendMessage(oneMB.slice(0, oneMB.length / 2))
            }}
          >
            Send 0.5MB message
          </button>
          <button
            style={{ marginTop: 10 }}
            type="button"
            onClick={() => {
              sendMessage(oneMB)
            }}
          >
            Send 1MB message
          </button>
          <button
            style={{ marginTop: 10 }}
            type="button"
            onClick={() => {
              sendMessage(tenMB.slice(0, tenMB.length / 2))
            }}
          >
            Send 5MB message
          </button>
          <button
            style={{ marginTop: 10 }}
            type="button"
            onClick={() => {
              sendMessage(tenMB)
            }}
          >
            Send 10MB message
          </button>
        </Box>
      </form>
    </Box>
  )
}
