import { Box } from 'components'
import { SignalingServer } from './signaling-server'
import { WebRtc } from './web-rtc'
import { IncomingMessage } from './incoming-message'
import { Bootstrap } from 'bootstrap/bootstrap'
import { WebRtcContext } from 'contexts/web-rtc-context'
import { config } from 'config'
import { Paring } from 'pairing/pairing'
import { useContext } from 'react'
import { Buffer } from 'buffer'
import { usePairingState } from 'hooks/use-paring-state'

const PairingLoader = () => {
  const pairingState = usePairingState()
  const webRtc = useContext(WebRtcContext)

  const setConnectionPassword = (password: string) => {
    webRtc?.signaling.subjects.wsConnectionPasswordSubject.next(
      Buffer.from(password, 'hex')
    )
  }

  if (pairingState === 'loading' || pairingState === 'paired') return null

  return (
    <Box style={{ display: 'none' }}>
      <WebRtcContext.Provider
        value={Bootstrap({
          logLevel: 'silent',
        })}
      >
        <Paring
          onPassword={(password) => {
            setConnectionPassword(password)
          }}
        />
      </WebRtcContext.Provider>
    </Box>
  )
}

const DevTools = () => (
  <Box>
    <SignalingServer />
    <WebRtc />
    <IncomingMessage />
  </Box>
)
export const DevToolsWrapper = () => (
  <Box p="medium">
    <WebRtcContext.Provider
      value={Bootstrap({
        logLevel: 'debug',
        signalingClientOptions: {
          ...config.signalingServer,
          source: 'wallet',
          target: 'extension',
        },
      })}
    >
      <DevTools />
      <PairingLoader />
    </WebRtcContext.Provider>
  </Box>
)
