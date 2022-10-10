import { Box } from 'components'
import { SignalingServer } from './signaling-server'
import { WebRtc } from './web-rtc'
import { IncomingMessage } from './incoming-message'
import { ConnectionSecret } from './connection-secret'
import { Bootstrap } from 'bootstrap/bootstrap'
import { WebRtcContext } from 'contexts/web-rtc-context'
import { config } from 'config'
import { Paring } from 'pairing/pairing'
import { useState } from 'react'
import { usePairingState } from 'hooks/use-paring-state'

const PairingLoader = ({
  setConnectionPassword,
}: {
  setConnectionPassword: (password: string) => void
}) => {
  const pairingState = usePairingState()

  if (pairingState === 'loading' || pairingState === 'paired') return null

  return (
    <Box style={{ display: 'none' }}>
      <WebRtcContext.Provider
        value={Bootstrap({
          logLevel: 'debug',
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

const DevTools = ({ connectionPassword }: { connectionPassword?: string }) => (
  <Box>
    <SignalingServer />
    <WebRtc />
    <IncomingMessage />
    <ConnectionSecret connectionPassword={connectionPassword} />
  </Box>
)
export const DevToolsWrapper = () => {
  const [connectionPassword, setConnectionPassword] = useState<
    string | undefined
  >()
  return (
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
        <DevTools connectionPassword={connectionPassword} />
        <PairingLoader setConnectionPassword={setConnectionPassword} />
      </WebRtcContext.Provider>
    </Box>
  )
}
