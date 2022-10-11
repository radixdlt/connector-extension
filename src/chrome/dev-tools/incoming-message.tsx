import { Box, Button, Text } from 'components'
import { WebRtcContext } from 'contexts/web-rtc-context'
import { useContext, useEffect, useState } from 'react'
import { Subscription } from 'rxjs'
import { Status } from 'signaling/subjects'
import { parseJSON } from 'utils'

export const IncomingMessage = () => {
  const webRtc = useContext(WebRtcContext)
  const [status, setStatus] = useState<Status>()
  const [text, setText] = useState<string>('')
  const [incomingMessage, setIncomingMessage] = useState<any>()

  useEffect(() => {
    if (!webRtc) return

    const subscription = new Subscription()

    subscription.add(
      webRtc.webRtc.subjects.rtcStatusSubject.subscribe((status) => {
        setStatus(status)
      })
    )

    subscription.add(
      webRtc.webRtc.subjects.rtcIncomingMessageSubject.subscribe((text) => {
        parseJSON(text).map((message) => {
          setIncomingMessage(message)

          if (message.method === 'request') {
            const response = {
              ...message,
              // eslint-disable-next-line max-nested-callbacks
              payload: message.payload.map((item: any) =>
                item.requestType === 'accountAddresses'
                  ? {
                      ...item,
                      addresses: [
                        {
                          label: 'Main account',
                          address:
                            'account_tdx_a_1qv3jfqugkm70ely0trae20wcwealxmj5zsacnhkllhgqlccnrp',
                        },
                        {
                          label: "NFT's",
                          address:
                            'account_tdx_a_1qd5svul20u30qnq408zhj2tw5evqrunq48eg0jsjf9qsx5t8qu',
                        },
                        {
                          label: 'Savings',
                          address:
                            'account_tdx_a_1qwz8dwm79jpq8fagt9vx0mug22ckznh3g45mfv4lmq2sjlwzqj',
                        },
                      ],
                    }
                  : item
              ),
            }
            setText(JSON.stringify(response, null, 2))
          } else if (message.method === 'sendTransaction') {
            const response = {
              ...message,
              // eslint-disable-next-line max-nested-callbacks
              payload: { transactionHash: crypto.randomUUID() },
            }
            setText(JSON.stringify(response, null, 2))
          }

          return undefined
        })
      })
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [webRtc])

  const disabledStyle =
    status !== 'connected'
      ? { background: '$muted', '&:hover': { background: '$muted' } }
      : {}

  const onSubmit = () => {
    if (text.length) {
      webRtc?.webRtc.subjects.rtcAddMessageToQueue.next(JSON.parse(text))
      setText('')
      setIncomingMessage(undefined)
    }
  }

  const onReject = () => {
    if (text.length) {
      webRtc?.webRtc.subjects.rtcAddMessageToQueue.next({
        error: 'rejectedByUser',
        message: 'user rejected request',
        requestId: incomingMessage.requestId,
      })
      setText('')
      setIncomingMessage(undefined)
    }
  }

  if (!incomingMessage) return null

  return (
    <Box>
      <form
        onSubmit={(ev) => {
          ev.preventDefault()
          onSubmit()
        }}
      >
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
            {JSON.stringify(incomingMessage, null, 2)}
          </pre>
        </Box>
        <Box>
          <Text>Response:</Text>

          <textarea
            rows={15}
            disabled={status !== 'connected'}
            style={{ width: '100%', boxSizing: 'border-box' }}
            onChange={(ev) => setText(ev.target.value)}
            value={text}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                onSubmit()
                event.preventDefault()
              }
            }}
          />
        </Box>
        <Box flex="row">
          <Button
            full
            size="small"
            css={disabledStyle}
            disabled={status !== 'connected'}
            onClick={() => onReject()}
          >
            Reject
          </Button>
          <Button
            full
            size="small"
            type="submit"
            css={disabledStyle}
            disabled={status !== 'connected'}
          >
            Approve
          </Button>
        </Box>
      </form>
    </Box>
  )
}
