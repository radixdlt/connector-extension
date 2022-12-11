import { ConnectionPassword } from './components/connection-password'
import { useConnectionPassword } from 'hooks/use-connection-password'
import { ConnectionStatus } from './components/connection-status'
import { PopupWindow } from 'components'
import { useConnectionStatus } from 'hooks/use-connection-status'
import { usePairingState } from 'hooks/use-paring-state'
import { useConnector } from 'hooks/use-connector'

export const Paring = () => {
  const connectionPassword = useConnectionPassword()
  const pairingState = usePairingState()
  const connector = useConnector()
  const connectionStatus = useConnectionStatus()

  return (
    <PopupWindow>
      {pairingState === 'notPaired' && (
        <ConnectionPassword value={connectionPassword} />
      )}
      {pairingState === 'paired' && (
        <ConnectionStatus
          activeConnection={connectionStatus === 'connected'}
          onForgetWallet={() => {
            connector?.generateConnectionPassword()
            connector?.connect()
          }}
        />
      )}
    </PopupWindow>
  )
}
