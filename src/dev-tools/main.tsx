import Box from 'components/box'
import Button from 'components/button'
import Text from 'components/text'
import { WebRtcContext } from 'contexts/web-rtc-context'
import { useContext, useEffect, useState } from 'react'
import { Subscription } from 'rxjs'
import { Status } from 'signaling/subjects'
import { Buffer } from 'buffer'

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
            message.info === 'remoteClientJustConnected' ||
            message.info === 'remoteClientIsAlreadyConnected'
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

  const disabledStyle =
    status !== 'connected'
      ? { background: '$muted', '&:hover': { background: '$muted' } }
      : {}

  const onSubmit = () => {
    if (text.length) {
      webRtc?.webRtc.subjects.rtcAddMessageToQueue.next(text)
      setText('')
    }
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
          <textarea
            rows={10}
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
        <Button
          full
          size="small"
          type="submit"
          css={disabledStyle}
          disabled={status !== 'connected'}
        >
          Send
        </Button>
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
