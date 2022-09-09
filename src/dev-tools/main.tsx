import Box from 'components/box'
import Button from 'components/button'
import Text from 'components/text'
import { WebRtcContext } from 'contexts/web-rtc-context'
import { useContext, useEffect, useState } from 'react'
import { Subscription } from 'rxjs'
import { Status } from 'signaling/subjects'
import { Buffer } from 'buffer'
import { parseJSON } from 'utils'

const MOCK_DATA = {
  accountAddress: {
    label: 'Main account',
    address: 'resource_sim1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqzqu57yag',
  },
}

const SignalingServer = () => {
  const webRtc = useContext(WebRtcContext)
  const [status, setStatus] = useState<Status>()

  useEffect(() => {
    if (!webRtc) return

    webRtc?.signaling.subjects.wsConnectSubject.next(true)

    const subscription = new Subscription()

    subscription.add(
      webRtc.signaling.subjects.wsStatusSubject.subscribe((status) => {
        setStatus(status)
      })
    )

    subscription.add(
      webRtc?.signaling.subjects.wsIncomingRawMessageSubject.subscribe(
        (raw) => {
          const message = JSON.parse(raw.data)
          if (
            [
              'remoteClientJustConnected',
              'remoteClientIsAlreadyConnected',
            ].includes(message.info)
          ) {
            webRtc?.webRtc.subjects.rtcCreateOfferSubject.next()
          }
        }
      )
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [webRtc])

  return (
    <Text>
      📡 Signaling server:{' '}
      {status === 'connected' ? `🟢` : status === 'disconnected' ? '🔴' : '⚪️'}
    </Text>
  )
}

const WebRtc = () => {
  const webRtc = useContext(WebRtcContext)
  const [status, setStatus] = useState<Status>()

  useEffect(() => {
    if (!webRtc) return

    const subscription = new Subscription()

    subscription.add(
      webRtc.webRtc.subjects.rtcStatusSubject.subscribe((status) => {
        setStatus(status)
      })
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [webRtc])

  return (
    <Text>
      🕸 Data channel:{' '}
      {status === 'connected' ? `🟢` : status === 'disconnected' ? '🔴' : '⚪️'}
    </Text>
  )
}

const Message = () => {
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
                  ? { ...item, addresses: [MOCK_DATA.accountAddress] }
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

const ConnectionSecret = () => {
  const webRtc = useContext(WebRtcContext)
  const [text, setText] = useState<string>('')
  const [connectionPassword, setConnectionPassword] = useState<boolean>(false)

  useEffect(() => {
    if (!webRtc) return

    const subscription = new Subscription()

    subscription.add(
      webRtc.signaling.subjects.wsConnectionPasswordSubject.subscribe(
        (password) => {
          setConnectionPassword(!!password)
        }
      )
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [webRtc])

  if (connectionPassword) return null

  const onSubmit = () => {
    webRtc?.signaling.subjects.wsConnectionPasswordSubject.next(
      Buffer.from(text, 'hex')
    )
    setText('')
  }

  return (
    <Box>
      <form
        onSubmit={(ev) => {
          ev.preventDefault()
          onSubmit()
        }}
      >
        <Box>
          <input
            style={{ width: '100%', boxSizing: 'border-box' }}
            onChange={(ev) => setText(ev.target.value)}
            value={text}
          />
        </Box>

        <Button full size="small" type="submit">
          Set connection password
        </Button>
      </form>
      <Button
        full
        size="small"
        onClick={() => {
          chrome.runtime.sendMessage({})
        }}
      >
        Open connection wizard
      </Button>
    </Box>
  )
}

export const Main = () => (
  <Box>
    <SignalingServer />
    <WebRtc />
    <Message />
    <ConnectionSecret />
  </Box>
)
